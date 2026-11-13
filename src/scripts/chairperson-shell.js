'use strict';

// Sidebar bell → Notifications. Only needed on pages whose own script
// doesn't already wire #notifBtn (Audit Log, Profile).
document.getElementById('notifBtn')?.addEventListener('click', () => {
  window.location.href = 'notifications.html';
});
