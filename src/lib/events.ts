import EventEmitter from "eventemitter3";

export const PubSub = new EventEmitter();

export const EventType = {
  START_ASSETS_CREATION: "start_assets_creation",
  STOP_ASSETS_CREATION: "stop_assets_creation",
};
