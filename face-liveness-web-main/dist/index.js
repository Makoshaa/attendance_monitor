import './globals.d.ts';
import { captureAndSendSnapshot } from './main';
// Expose for the button onclick
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;
window.captureAndSendSnapshot = captureAndSendSnapshot;
