<?php

/*
 * BrynForum Top Posters — extension wiring.
 *
 * Public API endpoint + forum-side widget on IndexPage. Admin settings
 * panel via registerSetting (no DB migration — settings live in
 * flarum_settings keyed by `brynforum-top-posters.*`).
 */

use BrynForum\TopPosters\Api\Controller\ListTopPostersController;
use Flarum\Extend;

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__.'/js/dist/forum.js')
        ->css(__DIR__.'/less/forum.less'),

    (new Extend\Frontend('admin'))
        ->js(__DIR__.'/js/dist/admin.js'),

    (new Extend\Routes('api'))
        ->get(
            '/brynforum/top-posters',
            'brynforum.top-posters.index',
            ListTopPostersController::class,
        ),

    (new Extend\Settings())
        ->default('brynforum-top-posters.show_monthly', '1')
        ->default('brynforum-top-posters.show_alltime', '1')
        ->default('brynforum-top-posters.monthly_limit', '10')
        ->default('brynforum-top-posters.alltime_limit', '10')
        ->default('brynforum-top-posters.title_monthly', 'Top Posters This Month')
        ->default('brynforum-top-posters.title_alltime', 'Top Posters of All Time')
        ->default('brynforum-top-posters.exclude_admins', '0')
        ->default('brynforum-top-posters.exclude_moderators', '0')
        ->serializeToForum('brynforum-top-posters.showMonthly', 'brynforum-top-posters.show_monthly', 'boolval')
        ->serializeToForum('brynforum-top-posters.showAlltime', 'brynforum-top-posters.show_alltime', 'boolval')
        ->serializeToForum('brynforum-top-posters.monthlyLimit', 'brynforum-top-posters.monthly_limit', 'intval')
        ->serializeToForum('brynforum-top-posters.alltimeLimit', 'brynforum-top-posters.alltime_limit', 'intval')
        ->serializeToForum('brynforum-top-posters.titleMonthly', 'brynforum-top-posters.title_monthly')
        ->serializeToForum('brynforum-top-posters.titleAlltime', 'brynforum-top-posters.title_alltime'),
];
