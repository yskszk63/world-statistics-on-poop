import type { NextPage, GetStaticProps } from 'next'
import Head from 'next/head'
import styles from '../styles/Home.module.css'
import { Chart, ChartData, LineController, TimeScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js';
import 'chartjs-adapter-moment';
import autocolors from 'chartjs-plugin-autocolors';

import fs from 'fs';
import { fileURLToPath } from 'url';
import ndjson from 'ndjson';
import path from 'path';
import { useEffect, useRef } from 'react';

import type { ItemRecord } from '../types';

type Props = {
  data: ChartData<"line", (Date | null)[], Date>,
}

Chart.register(LineController, TimeScale, LinearScale, PointElement, LineElement, Tooltip, Legend, autocolors);

const Home: NextPage<Props> = ({data}) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvas.current) {
      throw new Error();
    }

    const options = {
      legend: {
        position: 'chartArea',
      },
      scales: {
        x: {
          type: 'time' as 'time',
          time: {
            minUnit: 'day' as 'day',
          },
        },
      },
    };

    const ctx = canvas.current;
    const chart = new Chart(ctx, {
      type: 'line',
      data,
      options,
      plugins: [ autocolors ],
    });
    return () => chart.destroy();
  }, [canvas, data]);

  return (
    <div className={styles.container}>
      <Head>
        <title>world-statistics-on-poop</title>
        <meta name="description" content="world-statistics-on-poop" />
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text x=%2250%%22 y=%2250%%22 style=%22dominant-baseline:central;text-anchor:middle;font-size:90px;%22>📈</text></svg>"
        />
      </Head>

      <main className={styles.main}>
        <canvas ref={canvas}/>
      </main>
    </div>
  )
}

export const getStaticProps: GetStaticProps<Props> = async function() {
  function isRecord(data: unknown): data is ItemRecord {
    if (data === null) {
      return false;
    }
    const d = data as ItemRecord;
    return d.version === 'v1' && typeof d.fragment === 'string' && typeof d.val === 'number' && typeof d.timestamp === 'string';
  }

  const records = await new Promise<ItemRecord[]>((resolve, reject) => {
    const records: ItemRecord[] = [];
    fs.createReadStream(path.join(fileURLToPath(import.meta.url), '../../../data/data.ndjson'))
      .pipe(ndjson.parse())
      .on('data', (record: unknown) => {
        if (!isRecord(record)) {
          throw new Error();
        }
        records.push(record)
      })
      .on('end', () => resolve(records))
      .on('error', (err: unknown) => reject(err));
  });

  const series = new Set<string>();
  const map = new Map();
  for (const record of records) {
    const timestamp = record.timestamp;

    let byTimestamp;
    if (!map.has(timestamp)) {
      byTimestamp = {};
      map.set(timestamp, byTimestamp);
    } else {
      byTimestamp = map.get(record.timestamp);
    }
    byTimestamp[record.fragment] = record.val;
    series.add(record.fragment);
  }

  const labels = Array.from(map.keys());
  const datasets = Array.from(series).map(fragment => {
    const label = fragment;
    const data: (Date | null)[] = labels.map(t => map.get(t)![fragment] ?? null);
    return {
      label,
      data,
    }
  });
  return {
    props: {
      data: {
        labels,
        datasets,
      },
    },
  }
}

export default Home
