import { Image, StyleSheet, Platform } from 'react-native';

import { HelloWave } from '@/components/HelloWave';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useEffect, useState } from 'react';

const IP = '192.168.1.5';

export default function HomeScreen() {
  const [logs, setLogs] = useState<{ alives: string[]; alerts: string[] }>({
    alives: [],
    alerts: [],
  });
  const [ws, setWs] = useState<WebSocket | null>(null);

  if (ws !== null) {
    ws.onmessage = (e) => {
      const log = JSON.parse(e.data) as {
        type: 'alive' | 'alert';
        body: string;
      };
      console.log('New WebSocket message:', log);

      if (log.type === 'alive') {
        const newLogs = {
          alives: [...logs.alives.slice(1), log.body],
          alerts: logs.alerts,
        };
        setLogs(newLogs);
      } else if (log.type === 'alert') {
        const newLogs = {
          alives: logs.alives,
          alerts: [...logs.alerts.slice(1), log.body],
        };
        setLogs(newLogs);
      }
    };
  }

  useEffect(() => {
    (async () => {
      const newLogs = await (
        await fetch(`http://${IP}:3000/?user=user&pass=pass&alertsLimit=20`)
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
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Welcome!</ThemedText>
        <HelloWave />
      </ThemedView>
      <ThemedView style={styles.sectionContainer}>
        <ThemedText type="subtitle">Alives</ThemedText>
        {logs.alives.map((alive, index) => (
          <ThemedText key={index} style={styles.listItem}>
            {alive}
          </ThemedText>
        ))}
      </ThemedView>
      <ThemedView style={styles.sectionContainer}>
        <ThemedText type="subtitle">Alerts</ThemedText>
        {logs.alerts.map((alert, index) => (
          <ThemedText key={index} style={styles.listItem}>
            {alert}
          </ThemedText>
        ))}
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
