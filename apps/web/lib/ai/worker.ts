// Runs the model off the main thread so typing and scrolling stay smooth.
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';
const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg: MessageEvent) => handler.onmessage(msg);
