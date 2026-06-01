<?php

namespace BrynForum\TopPosters\Api\Controller;

use Carbon\Carbon;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use Illuminate\Database\Query\JoinClause;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * GET /api/brynforum/top-posters?period=month|all&limit=N
 *
 * Public endpoint. Counts posts per user (type=comment, not deleted, not
 * private), joins users for avatar + display name, returns descending list.
 *
 * Pair with brynforum/api-cache to avoid running this aggregation per
 * page-load — the response is identical for every visitor so it's cheap
 * to cache.
 */
class ListTopPostersController implements RequestHandlerInterface
{
    public const MAX_LIMIT = 50;

    /**
     * Cached column-existence lookups. The schema doesn't change at runtime,
     * so we only probe each column once per process.
     */
    private static array $hasPostsColumn = [];

    public function __construct(
        protected SettingsRepositoryInterface $settings,
    ) {
    }

    /**
     * Whether the `posts` table has the named column right now.
     *
     * Used to gate optional WHERE clauses against columns added by sibling
     * extensions: `is_approved` (flarum/approval) and `is_spam` (fof/anti-spam)
     * are both common but not guaranteed on every install. Without these
     * guards the join SQL would 1054 on a fresh Flarum.
     */
    private function hasPostsColumn(string $column): bool
    {
        return self::$hasPostsColumn[$column]
            ??= Schema::hasColumn('posts', $column);
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $params = $request->getQueryParams();
        $period = ($params['period'] ?? 'month') === 'all' ? 'all' : 'month';

        // Limit: query param wins, falls back to setting, capped at MAX_LIMIT.
        $defaultLimit = (int) $this->settings->get(
            $period === 'all'
                ? 'brynforum-top-posters.alltime_limit'
                : 'brynforum-top-posters.monthly_limit',
            10,
        );
        $limit = (int) ($params['limit'] ?? $defaultLimit);
        $limit = max(1, min($limit, self::MAX_LIMIT));

        $excludeAdmins = (bool) $this->settings->get('brynforum-top-posters.exclude_admins');
        $excludeModerators = (bool) $this->settings->get('brynforum-top-posters.exclude_moderators');

        $rows = $this->query($period, $limit, $excludeAdmins, $excludeModerators);

        return new JsonResponse([
            'period' => $period,
            'data' => $rows->map(fn (User $user) => [
                'userId' => (int) $user->id,
                'username' => $user->username,
                // User::display_name is an accessor (no schema column) that
                // resolves to nickname → username via Flarum's user model.
                'displayName' => $user->display_name ?: $user->username,
                'avatarUrl' => $user->avatar_url
                    ? $this->avatarUrl($user->avatar_url)
                    : null,
                'postCount' => (int) $user->post_count,
            ])->all(),
        ]);
    }

    /**
     * Returns User models with an extra `post_count` attribute.
     *
     * The deleted_at / is_private / type filters mirror what the regular
     * post listing applies — we don't want a moderator's batch of soft-
     * deleted spam to bump the offender's count, and private byobu posts
     * shouldn't leak into a public leaderboard.
     *
     * NB: `flarum_users.display_name` doesn't exist as a column. The User
     * model exposes `$user->display_name` via accessor (resolves to
     * nickname-or-username at runtime), so we don't select it here.
     */
    protected function query(string $period, int $limit, bool $excludeAdmins, bool $excludeModerators)
    {
        $query = User::query()
            ->select('users.id', 'users.username', 'users.avatar_url')
            // COUNT(*) instead of COUNT(posts.id): selectRaw doesn't apply
            // the table prefix, so 'posts.id' would resolve to a literal
            // 'posts.id' (no flarum_ prefix) and 1054 the query. The inner
            // join means *-count == joined-row-count, same answer.
            ->selectRaw('COUNT(*) as post_count')
            ->join('posts', function (JoinClause $join) use ($period) {
                // Flarum's posts table uses hidden_at for soft-deletion; no
                // deleted_at column. The is_approved (flarum/approval) and
                // is_spam (fof/anti-spam) clauses are gated by schema-check
                // because those extensions add the columns via migration —
                // omit the WHERE when the column doesn't exist or the SQL
                // 1054s on a fresh Flarum that doesn't run either extension.
                $join->on('posts.user_id', '=', 'users.id')
                    ->where('posts.type', '=', 'comment')
                    ->whereNull('posts.hidden_at')
                    ->where('posts.is_private', '=', 0);

                if ($this->hasPostsColumn('is_approved')) {
                    $join->where('posts.is_approved', '=', 1);
                }
                if ($this->hasPostsColumn('is_spam')) {
                    $join->where('posts.is_spam', '=', 0);
                }

                if ($period === 'month') {
                    // Calendar month, not rolling 30 days — "Top Posters This
                    // Month" resets at midnight on the 1st as the widget label
                    // promises. Rolling-window semantics surprised users on
                    // 2026-06-01 because every post still fell inside the prior
                    // 30 days, so month and all-time looked identical.
                    $join->where(
                        'posts.created_at',
                        '>=',
                        Carbon::now()->startOfMonth(),
                    );
                }
            })
            ->groupBy('users.id', 'users.username', 'users.avatar_url')
            ->orderByDesc('post_count')
            // Tiebreaker: username ascending (case-insensitive). Without it,
            // users tied on post_count appear in whatever order MySQL feels
            // like — surprising and looks random to readers. orderByRaw
            // skips Eloquent's table-prefix wrapping, so reference the
            // SELECT output alias `username` (which MySQL/MariaDB resolve
            // in ORDER BY) rather than `users.username` directly.
            ->orderByRaw('LOWER(username) ASC')
            ->take($limit);

        // Hide staff if the operator opted in. Subqueries (rather than
        // pluck-then-whereNotIn) so MySQL can plan the join: staff sets
        // are tiny (typically <50 users) but a subquery keeps the SQL
        // small and avoids a roundtrip.
        if ($excludeAdmins) {
            // Group id 1 is hard-coded as Administrators in Flarum core.
            $query->whereNotIn('users.id', function ($q) {
                $q->select('user_id')
                    ->from('group_user')
                    ->where('group_id', 1);
            });
        }

        if ($excludeModerators) {
            // "Moderator" = anyone in a group with the `discussion.hidePosts`
            // permission. That's Flarum's foundational mod permission and
            // the single most reliable signal across forums where the group
            // *names* differ (Mod / Staff / Editor / etc.).
            $query->whereNotIn('users.id', function ($q) {
                $q->select('gu.user_id')
                    ->from('group_user as gu')
                    ->whereIn('gu.group_id', function ($qq) {
                        $qq->select('group_id')
                            ->from('group_permission')
                            ->where('permission', 'discussion.hidePosts');
                    });
            });
        }

        return $query->get();
    }

    /**
     * Flarum stores only the avatar's filename (or NULL) in users.avatar_url.
     * The public URL is `<forum_url>/assets/avatars/<filename>`.
     *
     * If the column already holds a full URL (legacy migrations, third-party
     * extensions) we leave it alone.
     */
    protected function avatarUrl(string $avatar): string
    {
        if (str_starts_with($avatar, 'http://') || str_starts_with($avatar, 'https://')) {
            return $avatar;
        }

        $base = rtrim((string) $this->settings->get('url'), '/');

        return $base.'/assets/avatars/'.$avatar;
    }
}
