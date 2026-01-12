import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SQLite from 'expo-sqlite';
import { generateContextualNotification } from './llmService';

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

import { Alert } from 'react-native';

// ... imports ...

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
    Alert.alert(
      'Notifications Required',
      'To help you during danger hours, please enable notifications in your phone settings.',
      [{ text: 'OK' }]
    );
    return false;
  }
  
  // Note: "Screen Time" tracking uses AppState (foreground/background) 
  // and does not require a special OS permission on iOS/Android for this method.
  console.log('✅ Notification permissions granted');

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
    const targetHour = hours[0];
    const lastHour = hours[hours.length - 1];
    
    // Calculate next occurrence in LOCAL time
    const now = new Date();
    const localHour = now.getHours();
    const localMinute = now.getMinutes();
    
    // Create target date for the one-off notification
    const targetDate = new Date();
    
    // LOGIC FIX: Check if we are currently INSIDE the danger window
    // If inside, schedule an immediate catch-up notification (e.g., in 2 minutes)
    // instead of waiting for the next cycle (which might be tomorrow).
    if (hours.includes(localHour)) {
      console.log(`⚠️ Currently inside "${window}" window (Hour: ${localHour}). Scheduling immediate catch-up.`);
      targetDate.setMinutes(localMinute + 2); // Fire in 2 minutes
      targetDate.setSeconds(0);
    } 
    // If not inside, use standard scheduling logic
    else {
      targetDate.setHours(targetHour, 0, 0, 0);
      
      // If target time has passed today (and we are not inside the window), schedule for tomorrow
      // Special case for 'verylate' (0-5) where target (0) is less than current (23) but is technically "next"
      if (localHour > lastHour) {
        // Past the entire window for today -> Tomorrow
        targetDate.setDate(targetDate.getDate() + 1);
      } else if (localHour > targetHour && !hours.includes(localHour)) {
        // Example: Now 12, Window 6-10. Not in window, past start. Tomorrow.
         targetDate.setDate(targetDate.getDate() + 1);
      }
       // If localHour < targetHour (e.g. Now 22, Target 0), targetDate (Today 00:00) is in past.
       // We need Tomorrow 00:00.
       if (targetDate.getTime() < now.getTime()) {
          targetDate.setDate(targetDate.getDate() + 1);
       }
    }
    
    // Generate contextual message (will use mock LLM)
    const message = await generateContextualNotification();
    
    // Log for debugging
    console.log(`📅 Scheduling "${window}" notification:`);
    console.log(`   Target hour: ${targetHour}:00 (Recurring)`);
    console.log(`   One-off trigger: ${targetDate.toLocaleString()} (Local)`);

    // Use DATE trigger for first occurrence (guaranteed local time)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Interruption',
        body: message,
        data: { type: 'danger_hour_check_in', hour: targetHour, window },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: targetDate,
      },
    });
    
    // Also schedule recurring DAILY trigger for subsequent days
    // Note: DAILY trigger uses local timezone on most devices
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Interruption',
        body: message,
        data: { type: 'danger_hour_recurring', hour: targetHour, window },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: targetHour,
        minute: 0,
        repeats: true,
      },
    });
    
    console.log(`   ✅ Scheduled both immediate and recurring notifications`);
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
      repeats: false,
    },
  });

  console.log('Test notification scheduled for 3 seconds from now');
};

// Get scheduled notifications (for debugging)
export const getScheduledNotifications = async () => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  console.log('📋 Scheduled notifications:', scheduled.length);
  
  // Log details for each notification
  scheduled.forEach((notif, index) => {
    const trigger = notif.trigger as any;
    console.log(`\n  [${index + 1}] ${notif.content.title}`);
    console.log(`      Body: ${notif.content.body?.substring(0, 50)}...`);
    console.log(`      Data: ${JSON.stringify(notif.content.data)}`);
    
    if (trigger.type === 'daily') {
      console.log(`      Trigger: DAILY at ${trigger.hour}:${String(trigger.minute || 0).padStart(2, '0')} local time`);
    } else if (trigger.type === 'date') {
      const triggerDate = new Date(trigger.date || trigger.value);
      console.log(`      Trigger: DATE - ${triggerDate.toLocaleString()}`);
    } else if (trigger.type === 'timeInterval') {
      console.log(`      Trigger: TIME_INTERVAL - ${trigger.seconds} seconds`);
    } else {
      console.log(`      Trigger: ${JSON.stringify(trigger)}`);
    }
  });
  
  return scheduled;
};
