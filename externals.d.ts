declare module 'chartjs-adapter-moment' { }

declare module 'chartjs-plugin-autocolors' {
  import { Plugin } from 'chart.js';

  declare const plugin: Plugin;
  export default plugin;
}
