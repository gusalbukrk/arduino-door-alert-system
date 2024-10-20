import { Image, StyleSheet, View } from 'react-native';

import { HelloWave } from '@/components/HelloWave';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useEffect, useState } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Collapsible } from '@/components/Collapsible';

const IP = '192.168.1.5';

export default function HomeScreen() {
  const { expoPushToken, notification } = usePushNotifications();
  // console.log('ExpoPushToken', expoPushToken?.data);
  const data = JSON.stringify(notification, undefined, 2);

  const [logs, setLogs] = useState<{ alives: string[]; alerts: string[] }>({
    alives: [],
    alerts: [],
  });
  const [secondsSinceLastAlive, setSecondsSinceLastAlive] = useState<
    number | null
  >(null);
  const [ws, setWs] = useState<WebSocket | null>(null);

  // if (logs.alives.length !== 0) {
  //   console.log(hasNSecondsPassedSince(120, logs.alives.at(-1)!));
  // }

  if (ws !== null) {
    ws.onmessage = (e) => {
      const log = JSON.parse(e.data) as {
        type: 'alive' | 'alert';
        body: string;
      };
      console.log('New WebSocket message:', log);

      if (log.type === 'alive') {
        const newLogs = {
          alives: [...logs.alives, log.body],
          alerts: logs.alerts,
        };
        setLogs(newLogs);
      } else if (log.type === 'alert') {
        const newLogs = {
          alives: logs.alives,
          alerts: [...logs.alerts, log.body],
        };
        setLogs(newLogs);
      }
    };
  }

  useEffect(() => {
    if (expoPushToken === undefined) return;

    (async () => {
      const resp = await fetch(
        `http://${IP}:3000/register?user=user&pass=pass&token=${expoPushToken?.data}`,
      );

      if (resp.status !== 200) {
        alert(await resp.text());
      }
    })();
  }, [expoPushToken]);

  useEffect(() => {
    (async () => {
      const newLogs = await (
        await fetch(
          `http://${IP}:3000/?user=user&pass=pass&alivesLimit=1000&alertsLimit=1000`,
        )
      ).json();
      setLogs(newLogs);
    })();
  }, []);

  useEffect(() => {
    const ws = new WebSocket(`ws://${IP}:3000`);
    setWs(ws);

    ws.onopen = () => {
      console.log('WebSocket connection opened');
    };

    ws.onerror = (e) => {
      console.error('WebSocket error: ', e);
    };

    ws.onclose = (e) => {
      console.log('WebSocket closed: ', e.code, e.reason);
    };

    // cleanup the WebSocket connection when the component unmounts
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  useEffect(() => {
    if (logs.alives.length === 0) return;

    const secondsSinceLastAlive = getSecondsSince(logs.alives.at(-1)!);
    setSecondsSinceLastAlive(secondsSinceLastAlive);

    const interval = setInterval(() => {
      setSecondsSinceLastAlive(getSecondsSince(logs.alives.at(-1)!));
    }, 1000);
    return () => clearInterval(interval);
  }, [logs]);

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/arduino.png')}
          style={styles.reactLogo}
          resizeMode="contain"
        />
      }
    >
      {logs.alives.length !== 0 && secondsSinceLastAlive !== null && (
        <>
          <ThemedView style={[styles.titleContainer, { marginBottom: 0 }]}>
            {secondsSinceLastAlive >= 120 ? (
              <>
                <ThemedText type="subtitle">🔴</ThemedText>
                <ThemedText type="title" style={{ lineHeight: 36 }}>
                  Down
                </ThemedText>
              </>
            ) : (
              <>
                <ThemedText type="subtitle">🟢</ThemedText>
                <ThemedText type="title">Up</ThemedText>
              </>
            )}
          </ThemedView>
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="defaultSemiBold">
              Last alive signal: {secondsSinceLastAlive} seconds ago
            </ThemedText>
          </ThemedView>
        </>
      )}
      <ThemedView style={styles.sectionContainer}>
        <ThemedText type="subtitle">Alives</ThemedText>
        {logs.alives.length === 0 && (
          <ThemedText style={styles.listItem}>No alives</ThemedText>
        )}
        {reverse(logs.alives)
          .slice(0, 5)
          .map((alive, index) => (
            <ThemedText key={index} style={styles.listItem}>
              {alive}
            </ThemedText>
          ))}
        {logs.alives.length > 5 && (
          <Collapsible title="More" style={{ marginTop: 4 }}>
            {reverse(logs.alives)
              .slice(5)
              .map((alive, index) => (
                <ThemedText key={index} style={styles.listItem}>
                  {alive}
                </ThemedText>
              ))}
          </Collapsible>
        )}
      </ThemedView>
      <ThemedView style={styles.sectionContainer}>
        <ThemedText type="subtitle">Alerts</ThemedText>
        {logs.alerts.length === 0 && (
          <ThemedText style={styles.listItem}>No alerts</ThemedText>
        )}
        {reverse(logs.alerts)
          .slice(0, 5)
          .map((alert, index) => (
            <ThemedText key={index} style={styles.listItem}>
              {alert}
            </ThemedText>
          ))}
        {logs.alerts.length > 5 && (
          <Collapsible title="More" style={{ marginTop: 4 }}>
            {reverse(logs.alerts)
              .slice(5)
              .map((alert, index) => (
                <ThemedText key={index} style={styles.listItem}>
                  {alert}
                </ThemedText>
              ))}
          </Collapsible>
        )}
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 32,
  },
  sectionContainer: {
    gap: 8,
    marginBottom: 32,
  },
  reactLogo: {
    height: 178,
    width: 290,
  },
  listItem: {
    paddingLeft: 24,
  },
});

function getDate(dateString: string) {
  const [datePart, timePart] = dateString.split(' ');

  const [day, month, year] = datePart.split('/').map(Number);
  const [hours, minutes, seconds] = timePart.split(':').map(Number);

  const date = new Date(year, month - 1, day, hours, minutes, seconds);

  return date;
}

function hasNSecondsPassedSince(seconds: number, dateString: string) {
  const date = getDate(dateString);

  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diff / 1000);

  return diffMinutes >= seconds;
}

function getSecondsSince(dateString: string) {
  const date = getDate(dateString);

  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diff / 1000);

  return diffSeconds;
}

function reverse<T>(arr: T[]) {
  return [...arr].reverse();
}
