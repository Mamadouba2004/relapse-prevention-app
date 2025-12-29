import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SQLite from 'expo-sqlite';

// Set notification handler (how notifications appear)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const initNotifications = async () => {
  if (!Device.isDevice) {
    console.log('Notifications only work on physical devices');
    return false;
  }

  // Request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Failed to get push notification permissions');
    return false;
  }

  return true;
};

// Schedule notifications based on user's danger hours
export const scheduleDangerHourNotifications = async () => {
  const db = await SQLite.openDatabaseAsync('behavior.db');

  try {
    // Get user's risk hours from profile
    const profile = await db.getAllAsync<{ risk_hours: string }>(
      'SELECT risk_hours FROM user_profile ORDER BY created_at DESC LIMIT 1'
    );

    if (profile.length === 0) {
      console.log('No user profile found');
      return;
    }

    const riskHours = JSON.parse(profile[0].risk_hours) as string[];

    // Cancel all existing scheduled notifications
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Schedule notifications for each danger window
    for (const window of riskHours) {
      await scheduleWindowNotification(window);
    }

    console.log('✅ Notifications scheduled for danger hours:', riskHours);
  } catch (error) {
    console.error('Error scheduling notifications:', error);
  }
};

const scheduleWindowNotification = async (window: string) => {
  const timeRanges: { [key: string]: number[] } = {
    'morning': [6, 7, 8, 9, 10, 11],
    'afternoon': [12, 13, 14, 15, 16, 17],
    'evening': [18, 19, 20, 21],
    'latenight': [22, 23],
    'verylate': [0, 1, 2, 3, 4, 5],
  };

  const hours = timeRanges[window] || [];

  // Schedule one check-in per window (first hour of window)
  if (hours.length > 0) {
    const hour = hours[0];

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Interruption',
        body: "Just a heads up — this might be a tricky moment. You don't have to do anything.",
        data: { type: 'danger_hour_check_in', hour },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: hour,
        minute: 0,
      },
    });
  }
};

// Schedule extra support after lapse (every 2 hours for 48 hours)
export const schedulePostLapseSupport = async () => {
  const db = await SQLite.openDatabaseAsync('behavior.db');

  try {
    // Check if user requested extra support
    const recentLapse = await db.getAllAsync<{
      lapse_timestamp: number;
      extra_support_enabled: number;
      check_in_frequency_hours: number;
    }>(
      'SELECT * FROM lapse_recovery WHERE extra_support_enabled = 1 ORDER BY created_at DESC LIMIT 1'
    );

    if (recentLapse.length === 0) {
      return;
    }

    const lapseTime = recentLapse[0].lapse_timestamp;
    const now = Date.now();
    const hoursSinceLapse = (now - lapseTime) / (1000 * 60 * 60);

    // Only schedule if within 48 hours of lapse
    if (hoursSinceLapse > 48) {
      return;
    }

    // Schedule check-ins every 2 hours
    const frequency = recentLapse[0].check_in_frequency_hours;
    const checksRemaining = Math.ceil((48 - hoursSinceLapse) / frequency);

    for (let i = 1; i <= checksRemaining; i++) {
      const triggerTime = new Date(now + (i * frequency * 60 * 60 * 1000));

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Interruption',
          body: "How are you holding up? The next day or two can be tough. We're here.",
          data: { type: 'post_lapse_check_in' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerTime,
        },
      });
    }

    console.log(`✅ Scheduled ${checksRemaining} post-lapse check-ins`);
  } catch (error) {
    console.error('Error scheduling post-lapse support:', error);
  }
};

// Manual test notification
export const sendTestNotification = async () => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Interruption',
      body: "Just a heads up — this might be a tricky moment. You don't have to do anything.",
      data: { type: 'test' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3,
    },
  });

  console.log('Test notification scheduled for 3 seconds from now');
};

// Get scheduled notifications (for debugging)
export const getScheduledNotifications = async () => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  console.log('Scheduled notifications:', scheduled.length);
  return scheduled;
};
