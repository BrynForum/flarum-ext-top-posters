import Component from 'flarum/common/Component';
import app from 'flarum/forum/app';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import UserCard from 'flarum/forum/components/UserCard';
import avatar from 'flarum/common/helpers/avatar';
import username from 'flarum/common/helpers/username';
import stringToColor from 'flarum/common/utils/stringToColor';

/**
 * One leaderboard card. Fetches /api/brynforum/top-posters once on mount,
 * then renders the result.
 *
 * Mobile responsive: collapsed (header only) by default on viewports
 * narrower than 768px, expanded on desktop. Tap the header to toggle.
 *
 * Visibility itself is purely CSS-driven (less/forum.less media queries):
 * desktop always shows the body; mobile hides it unless `.is-expanded` is
 * on the root. That way the layout responds to live viewport resizes
 * without us wiring up a window.resize listener.
 */
export default class TopPostersCard extends Component {
    oninit(vnode) {
        super.oninit(vnode);
        this.users = null;
        this.loading = true;
        this.error = false;

        // `expanded` only affects mobile (CSS desktop rule overrides). Start
        // closed so a phone load doesn't briefly flash content open.
        this.expanded = false;

        // Hover-card state, per-user (rows render N times so we key by id).
        // userModels caches the User instance fetched from app.store on the
        // first hover so subsequent hovers + redraws don't re-fetch.
        this.cardVisible = {};   // userId → boolean
        this.userModels  = {};   // userId → User (or undefined while pending)
        this.hoverTimers = {};   // userId → setTimeout handle

        this.load();
    }

    onremove() {
        // Clear pending hover timers so a redraw-after-unmount doesn't try
        // to call m.redraw on a detached component.
        Object.values(this.hoverTimers).forEach(clearTimeout);
    }

    load() {
        const { period, limit } = this.attrs;

        app.request({
            method: 'GET',
            url: app.forum.attribute('apiUrl') + '/brynforum/top-posters',
            params: { period, limit },
        })
            .then((res) => {
                this.users = (res && res.data) || [];
                this.loading = false;
                m.redraw();
            })
            .catch(() => {
                this.users = [];
                this.loading = false;
                this.error = true;
                m.redraw();
            });
    }

    toggle() {
        this.expanded = !this.expanded;
    }

    view() {
        const { title } = this.attrs;
        const expandedClass = this.expanded ? ' is-expanded' : '';

        return m('.TopPostersCard' + expandedClass, [
            m('button.TopPostersCard-header', {
                type: 'button',
                onclick: () => this.toggle(),
                'aria-expanded': this.expanded ? 'true' : 'false',
            }, [
                m('span.TopPostersCard-title', title),
                m('span.TopPostersCard-toggle', m(
                    'i.fas',
                    { className: this.expanded ? 'fa-chevron-up' : 'fa-chevron-down' },
                )),
            ]),
            m('.TopPostersCard-body', this.renderBody()),
        ]);
    }

    renderBody() {
        if (this.loading) return m(LoadingIndicator);
        if (this.error) return m('p.TopPostersCard-empty', 'Could not load top posters.');
        if (!this.users || this.users.length === 0) {
            return m('p.TopPostersCard-empty', 'No posts in this period yet.');
        }

        return m('ol.TopPostersCard-list', this.users.map((u, i) => this.renderRow(u, i + 1)));
    }

    renderRow(u, rank) {
        const userObj = makeUserShim(u);
        const visible = this.cardVisible[u.userId] && this.userModels[u.userId];

        // Replicate Flarum core's PostUser hover pattern: the row is a
        // `.PostUser` container (which the core CSS already styles as
        // `position: relative` so a `.UserCard--popover` child positions
        // itself underneath). Mouseover/mouseout toggle a 500ms / 250ms
        // debounced state and the UserCard renders inline when both the
        // state flag is true AND the user model has finished loading.
        // mouseENTER/LEAVE (not mouseOVER/OUT) — the latter bubble from
        // child elements, so as the cursor moves from the avatar onto the
        // username an unwanted `mouseout` would fire and cancel our show
        // timer before the 500ms could elapse. Enter/leave only fire on
        // the row boundary, which is what we want.
        //
        // Native addEventListener via oncreate (rather than Mithril
        // `onmouseenter` attribute) — Mithril 2.x's attribute-style event
        // handlers are reliable for `on{click,mouseover,etc.}` but in
        // practice we hit bindings that didn't fire on this row; using
        // the DOM directly removes any doubt.
        return m('li.TopPostersCard-row.PostUser', {
            key: u.userId,
            oncreate: (vnode) => {
                vnode.dom.addEventListener('mouseenter', () => this.startShowCard(u.userId));
                vnode.dom.addEventListener('mouseleave', () => this.startHideCard(u.userId));
            },
        }, [
            m('span.TopPostersCard-rank', rank),
            m('a.TopPostersCard-user', {
                href: app.route('user', { username: u.username }),
                config: m.route,
                'data-id': u.userId,
            }, [
                avatar(userObj, { className: 'TopPostersCard-avatar' }),
                m('span.TopPostersCard-name', username(userObj)),
            ]),
            m('span.TopPostersCard-count', formatCount(u.postCount)),
            // `in` class is essential: Flarum core CSS sets
            // `.PostUser .UserCard { opacity: 0 }` by default and only
            // `.in` flips it to `opacity: 1`. Core's PostUser adds the
            // class via setTimeout(() => $.addClass('in')) for the fade
            // animation; we just add it inline since we want it visible
            // immediately on render.
            visible && m(UserCard, {
                user: this.userModels[u.userId],
                className: 'UserCard--popover in',
            }),
        ]);
    }

    /**
     * Schedule showing the user-card popover after 500ms — matches the
     * delay PostUser uses on regular post headers. If the user isn't yet
     * in the store, fetch it via app.store.find('users', id) (a single
     * /api/users/<id> roundtrip) and trigger a redraw when it arrives.
     */
    startShowCard(userId) {
        clearTimeout(this.hoverTimers[userId]);
        this.hoverTimers[userId] = setTimeout(() => {
            // Always force a fresh find() so we get the User WITH its
            // relations (badges, groups). getById() can return a partial
            // record cached by some other view (e.g. discussion list)
            // that doesn't have user.badges() loaded — calling
            // user.badges().toArray() then throws and UserCard renders to
            // nothing.
            app.store.find('users', userId).then((user) => {
                this.userModels[userId] = user;
                this.cardVisible[userId] = true;
                m.redraw();
            });
        }, 500);
    }

    startHideCard(userId) {
        clearTimeout(this.hoverTimers[userId]);
        this.hoverTimers[userId] = setTimeout(() => {
            this.cardVisible[userId] = false;
            m.redraw();
        }, 250);
    }
}

/**
 * Build a minimal object with the methods Flarum's `avatar` and `username`
 * helpers expect. We avoid pulling the User store because the API endpoint
 * already gives us the fields we need; cheaper than triggering another
 * roundtrip via app.store.find().
 *
 * `color()` mirrors Flarum's User model: when the user has no uploaded
 * avatar we hash the display name into a stable hex colour. Without this,
 * the avatar helper sets --avatar-bg to undefined and the placeholder
 * letter renders against a transparent background (just a floating "A").
 */
function makeUserShim(u) {
    const displayName = u.displayName || u.username;
    return {
        id: () => u.userId,
        username: () => u.username,
        displayName: () => displayName,
        avatarUrl: () => u.avatarUrl,
        color: () => (u.avatarUrl ? '' : '#' + stringToColor(displayName)),
        isDeleted: () => false,
    };
}

function formatCount(n) {
    return String(n);
}
