import Component from 'flarum/common/Component';
import TopPostersCard from './TopPostersCard';
import app from 'flarum/forum/app';

/**
 * Container that holds the two cards (monthly + all-time). One panel
 * for both so we can hide the whole thing when both are off.
 */
export default class TopPostersPanel extends Component {
    view() {
        const showMonthly = !!app.forum.attribute('brynforum-top-posters.showMonthly');
        const showAlltime = !!app.forum.attribute('brynforum-top-posters.showAlltime');

        if (!showMonthly && !showAlltime) return null;

        return m('.TopPostersPanel', [
            showMonthly && m(TopPostersCard, {
                period: 'month',
                title: app.forum.attribute('brynforum-top-posters.titleMonthly') || 'Top Posters This Month',
                limit: app.forum.attribute('brynforum-top-posters.monthlyLimit') || 10,
            }),
            showAlltime && m(TopPostersCard, {
                period: 'all',
                title: app.forum.attribute('brynforum-top-posters.titleAlltime') || 'Top Posters of All Time',
                limit: app.forum.attribute('brynforum-top-posters.alltimeLimit') || 10,
            }),
        ]);
    }
}
