import { extend } from 'flarum/common/extend';
import app from 'flarum/forum/app';
import IndexPage from 'flarum/forum/components/IndexPage';
import TopPostersPanel from './components/TopPostersPanel';

// Tag the body when oxotheme is the active theme so the LESS can opt
// into its 13px-card aesthetic without us hard-coding it everywhere.
//
// Detection: oxotheme is CSS-only (no JS bundle) so it doesn't appear in
// `flarum.extensions`. Probe the DOM instead — inject a hidden `<div
// class="Hero">` and check its computed border-radius against oxo's
// signature rule (`.Hero { border-radius: 15px }`). Default Flarum
// doesn't style `.Hero`, so any non-zero radius means oxo is loaded.
// `toggle` not `add` so disabling oxotheme on a later boot REMOVES the
// class rather than leaving a stale marker behind.
const tagOxo = () => {
    if (!document.body) return;
    const probe = document.createElement('div');
    probe.className = 'Hero';
    probe.style.cssText = 'position:absolute;visibility:hidden;left:-9999px;width:1px;height:1px';
    document.body.appendChild(probe);
    const on = getComputedStyle(probe).borderRadius === '15px';
    probe.remove();
    document.body.classList.toggle('has-oxotheme', on);
};

app.initializers.add('brynforum-top-posters', () => {
    tagOxo();
    setTimeout(tagOxo, 0);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tagOxo);
    }

    // Render the panel(s) above the discussion list on IndexPage. We hook
    // `view` rather than `oninit` so the panel re-renders when index state
    // changes (filter switches, sort, etc.) without us managing state.
    extend(IndexPage.prototype, 'view', function (vdom) {
        if (!this.currentTag || true) {
            // Always show on IndexPage regardless of tag context — the
            // top-poster lists aren't tag-scoped (yet). Future: a per-tag
            // mode could conditionally hide.
        }

        // Locate the IndexPage-results container and insert ourselves at the top.
        // vdom is the Mithril vnode tree returned by IndexPage.view; we look for
        // the results column by className.
        const results = findFirstNode(vdom, (n) =>
            n && n.attrs && /(^|\s)IndexPage-results(\s|$)/.test(n.attrs.className || ''),
        );
        if (results && Array.isArray(results.children)) {
            results.children.unshift(m(TopPostersPanel));
        }
    });
});

/**
 * Walk a Mithril vnode tree and return the first node matching `predicate`.
 * Cheap recursive scan; the tree depth on IndexPage is shallow so this is fine.
 */
function findFirstNode(node, predicate) {
    if (!node) return null;
    if (Array.isArray(node)) {
        for (const child of node) {
            const found = findFirstNode(child, predicate);
            if (found) return found;
        }
        return null;
    }
    if (predicate(node)) return node;
    if (node.children) return findFirstNode(node.children, predicate);
    return null;
}
