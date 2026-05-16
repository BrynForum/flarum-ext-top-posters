# brynforum/top-posters

[![Latest Version on Packagist](https://img.shields.io/packagist/v/brynforum/top-posters.svg?cacheSeconds=3600)](https://packagist.org/packages/brynforum/top-posters)
[![Total Downloads](https://img.shields.io/packagist/dt/brynforum/top-posters.svg?cacheSeconds=3600)](https://packagist.org/packages/brynforum/top-posters)
[![License](https://img.shields.io/packagist/l/brynforum/top-posters.svg?cacheSeconds=3600)](LICENSE)

A [Flarum](https://flarum.org) extension that adds **top-posters leaderboards** to the forum index. Shows the most active members of the past month and all time, side-by-side on desktop, stacked-and-collapsible on mobile.

Built and used in production by [BrynForum](https://brynforum.com).

## Features

- **Two leaderboards**: "This Month" (last 30 days) and "All Time". Each can be hidden independently.
- **Configurable list length** per leaderboard (1 – 50).
- **Editable headings** — translate or rebrand without touching code.
- **Exclude staff** — checkbox to drop administrators and/or moderators from the rankings.
- **Mobile-first**: collapses to a tap-to-expand summary on phones, fully visible on tablets/desktops. Pure CSS — no `window.resize` listener needed.
- **Cache-friendly**: public, `GET`-only endpoint with no per-user data. Pair with [brynforum/api-cache](https://github.com/brynforum/flarum-ext-api-cache) for one DB query per TTL window instead of per page-load.

## Installation

```bash
composer require brynforum/top-posters
```

Enable **Top Posters** under Admin → Extensions.

## Configuration

Admin → Top Posters:

| Setting | Default | Notes |
|---|---|---|
| Show "This Month" board | on | Hide the monthly leaderboard. |
| Show "All Time" board | on | Hide the all-time leaderboard. |
| "This Month" list length | 10 | 1 – 50. |
| "All Time" list length | 10 | 1 – 50. |
| "This Month" heading | `Top Posters This Month` | |
| "All Time" heading | `Top Posters of All Time` | |
| Exclude administrators | off | Hides users in the built-in Administrators group. |
| Exclude moderators | off | Hides users in any group that holds the `discussion.hidePosts` permission. |

The "Exclude moderators" check uses a permission, not a group name — so it works the same regardless of whether a forum's mod group is called Mods, Staff, Editors, etc.

## API

`GET /api/brynforum/top-posters?period=month&limit=10`
`GET /api/brynforum/top-posters?period=all&limit=10`

Public, no auth. Returns:

```json
{
  "period": "month",
  "data": [
    {
      "userId": 7,
      "username": "alice",
      "displayName": "Alice",
      "avatarUrl": "https://forum.example.com/assets/avatars/abc.png",
      "postCount": 142
    }
  ]
}
```

The query excludes:

- private posts (`is_private = 1`)
- hidden posts (`hidden_at IS NOT NULL`)
- unapproved posts (`is_approved = 0`)
- spam-flagged posts (`is_spam = 1`)
- post types other than `comment` (so discussion-renames etc. don't inflate)

Ties on `post_count` break by username ascending (case-insensitive), so the order is stable across requests.

## Recommended cache rule

If you also run [brynforum/api-cache](https://github.com/brynforum/flarum-ext-api-cache), add:

| Field | Value |
|---|---|
| Path pattern | `#^/api/brynforum/top-posters$#` |
| TTL | `600` (10 minutes — sensible default) |
| Scope | `public` |

That collapses the leaderboard SQL to once per ten minutes regardless of how many widget renders hit the endpoint.

## Mobile responsiveness

The two cards render in a flex row on desktop (>= 768 px) and stack on mobile. On mobile, the body of each card is hidden behind a tap-to-expand header. The state is purely CSS-driven, so resizing a desktop window down behaves correctly without a JS resize listener.

## Replacing afrux/top-posters-widget

This extension is intentionally similar in purpose to [afrux/top-posters-widget](https://github.com/afrux/top-posters-widget). The differences:

|  | afrux | brynforum |
|---|---|---|
| Layout | Right-side widget area (needs `afrux/forum-widgets-core`) | Inline above discussion list |
| Mobile | Hidden inside the widget panel | Accordion, always visible above the fold |
| Periods | This Month only | This Month + All Time (each toggleable) |
| Configurable list length | No | Yes (1 – 50, per board) |
| Staff exclusion | Yes | Yes |
| Dependencies | `afrux/forum-widgets-core` | Flarum core only |

If you switch from afrux, disable the old widget first to avoid duplicate boards.

## Contributing

Issues and PRs welcome. Keep changes small and focused; file an issue before any large PR.

## License

[MIT](LICENSE) © BrynForum
