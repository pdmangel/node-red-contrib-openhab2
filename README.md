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

Registers the address of an openHAB controller.
Configuration:
- Name : Specify a name
- openHAB host : Specify the hostname or ip address of the openHAB server
- openHAB port : Specify the port of the openHAB server

##### - openhab2-in

Listens to state changes of a selected openHAB Item.

Configuration:
- Name : Optionally specify a name
- Controller : Select the openHAB controller
- Item : Select the Item to monitor

Messages injected in NodeRED flows:
- <kbd>msg.payload</kbd> : the state of the selected item
- <kbd>msg.topic</kbd> : "state" or "statechanged"
- <kbd>msg.item</kbd> : the item's itemname (not label)

##### - openhab2-out

Sends commands to a selected openHAB Item.
E.g. "ON", "OFF", "REFRESH", ... 

Configuration
- Name : Optionally specify a name
- Controller : Select the openHAB controller
- Item : Select the Item to monitor
- Command : Optionally specify the command to send to the selected item. If specified, it overrides the command specified in the incoming message.


Messages accepted by NodeRED flows

- <kbd>msg.payload</kbd> : command to send to the selected item