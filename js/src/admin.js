import app from 'flarum/admin/app';

app.initializers.add('brynforum-top-posters', () => {
    app.extensionData
        .for('brynforum-top-posters')

        .registerSetting({
            setting: 'brynforum-top-posters.show_monthly',
            label: 'Show "This Month" board',
            type: 'boolean',
        })

        .registerSetting({
            setting: 'brynforum-top-posters.show_alltime',
            label: 'Show "All Time" board',
            type: 'boolean',
        })

        .registerSetting({
            setting: 'brynforum-top-posters.monthly_limit',
            label: '"This Month" list length',
            type: 'number',
            min: 1,
            max: 50,
            placeholder: '10',
        })

        .registerSetting({
            setting: 'brynforum-top-posters.alltime_limit',
            label: '"All Time" list length',
            type: 'number',
            min: 1,
            max: 50,
            placeholder: '10',
        })

        .registerSetting({
            setting: 'brynforum-top-posters.title_monthly',
            label: '"This Month" heading',
            type: 'text',
            placeholder: 'Top Posters This Month',
        })

        .registerSetting({
            setting: 'brynforum-top-posters.title_alltime',
            label: '"All Time" heading',
            type: 'text',
            placeholder: 'Top Posters of All Time',
        })

        .registerSetting({
            setting: 'brynforum-top-posters.exclude_admins',
            label: 'Exclude administrators from rankings',
            type: 'boolean',
            help: 'Hides users in the built-in Administrators group.',
        })

        .registerSetting({
            setting: 'brynforum-top-posters.exclude_moderators',
            label: 'Exclude moderators from rankings',
            type: 'boolean',
            help: 'Hides users in any group that has the "discussion.hidePosts" permission — covers Mod / Staff / Editor groups regardless of name.',
        });
});
