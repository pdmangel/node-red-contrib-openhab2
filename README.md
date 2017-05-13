# node-red-contrib-openhab2
## Description

Nodes facilitating the automation of *openHAB* ( <http://www.openhab.org> ) items with Node-RED ( <http://nodered.org> ).

## Installation

```
$ cd ~/.node-red
$ npm install node-red-contrib-openhab2
```

## Nodes

##### - openhab2-controller

Registers the address of an openHAB controller and listens to all items' events.

*Configuration:*
- Name : Specify a name
- openHAB host : Specify the hostname or ip address of the openHAB server
- openHAB port : Specify the port of the openHAB server

##### - openhab2-in

Listens to state changes of a selected openHAB Item.

*Configuration:*
- Name : Optionally specify a name
- Controller : Select the openHAB controller
- Item : Select the Item to monitor

*Messages injected in NodeRED flows (2 channels):*

Channel 1:
- <kbd>msg.item</kbd> : the item's itemname (not label)
- <kbd>msg.topic</kbd> : "StateEvent"
- <kbd>msg.payload</kbd> : the new state of the selected item

Channel 2:
- <kbd>msg.item</kbd> : the item's itemname (not label)
- <kbd>msg.topic</kbd> : "RawEvent"
- <kbd>msg.payload</kbd> :  raw (unprocessed) event for the selected item

##### - openhab2-monitor

Monitors the openhab2-controller node.

*Configuration:*
- Name : Optionally specify a name
- Controller : Select the openHAB controller

*Messages injected in NodeRED flows (3 channels):*

Channel 1:
- <kbd>msg.topic</kbd> : "ConnectionStatus"
- <kbd>msg.payload</kbd> : connection status ('ON' or 'OFF')

Channel 2:
- <kbd>msg.topic</kbd> : "ConnectionError"
- <kbd>msg.payload</kbd> : error message

Channel 3:
- <kbd>msg.topic</kbd> : "RawEvent"
- <kbd>msg.payload</kbd> :  raw (unprocessed) event for all items

##### - openhab2-out

Sends commands to a selected openHAB Item.
E.g. "ON", "OFF", "REFRESH", ... 

*Configuration:*
- Name : Optionally specify a name
- Controller : Select the openHAB controller
- Item : Select the Item to monitor
- Command : Optionally specify the command to send to the selected item. If specified, it overrides the command specified in the incoming message.


*Messages accepted by NodeRED flows:*

- <kbd>msg.payload</kbd> : command to send to the selected item