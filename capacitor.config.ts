import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.portalcamboriu.imobishare',
  appName: 'ImobiShare',
  webDir: 'dist',
  server: {
    url: 'https://imobishare.onrender.com',
    androidScheme: 'https'
  }
};

export default config;
