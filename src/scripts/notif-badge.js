/**
 * notif-badge.js
 * --------------
 * Keeps every page's bell badge (".notif-badge") in sync with the signed-in
 * user's real unread notification count, instead of the hardcoded "4" / "3"
 * that used to sit in the markup on every page.
 *
 * Include this once per page, after auth-check.js. Pages that render their
 * own notification list (notifications.html) additionally call
 * refreshNotifBadge() themselves whenever the count changes locally (read,
 * dismiss, ...) so the badge updates without a reload.
 */
'use strict';

async function refreshNotifBadge() {
  const badges = document.querySelectorAll('.notif-badge');
  const navLinks = document.querySelectorAll('.sidebar__link[href$="notifications.html"]');

  let count = 0;
  try {
    const res = await API.getUnreadCount();
    count = res.unread_count || 0;
  } catch (err) {
    console.error('[NotifBadge] Failed to load unread count:', err);
    return; // leave the badge as-is rather than show a stale/fake number
  }

  badges.forEach(badge => {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.style.display = count > 0 ? '' : 'none';
  });

  // Highlight the sidebar destination for every signed-in role/page.
  navLinks.forEach(link => {
    link.classList.toggle('sidebar__link--has-unread', count > 0);
    link.setAttribute('aria-label', count > 0
      ? `Notifications, ${count} unread`
      : 'Notifications');

    let indicator = link.querySelector('.notif-nav-indicator');
    if (count > 0) {
      if (!indicator) {
        indicator = document.createElement('span');
        indicator.className = 'notif-nav-indicator';
        indicator.setAttribute('aria-hidden', 'true');
        link.appendChild(indicator);
      }
      indicator.textContent = count > 99 ? '99+' : String(count);
    } else if (indicator) {
      indicator.remove();
    }
  });
}

document.addEventListener('authReady', refreshNotifBadge);
