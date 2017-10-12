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

Configuration node for communication with an openHAB controller.

*Configuration:*
- Name : Specify a name for the configuration node
- Protocol : "http" or "https"
- Host : Specify the hostname or ip address
- Port : (Optionally) Specify the ip port
- Path : (Optionally) Specify the additional base path
- Username : (Optionally) Specify the username to authenticate
- Password : (Optionally) Specify the password to authenticate

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

Sends commands or state updates to a selected openHAB Item.
E.g. "ON", "OFF", "REFRESH", ... 

*Configuration:*
- Name : Optionally specify a name
- Controller : Select the openHAB controller
- Item :  Optionally select the Item to address. If specified, it overrides the item specified in the incoming message.
- Topic : Optionally select "ItemCommand" or "ItemUpdate". If specified, it overrides the topic specified in the incoming message. 
- Payload : Optionally specify the command or update value to send to the selected item. If specified, it overrides the payload specified in the incoming message.


*Messages accepted by NodeRED flows:*

- <kbd>msg.item</kbd> : optionally the Item to address
- <kbd>msg.topic</kbd> :  optionally "ItemCommand", "ItemUpdate"
- <kbd>msg.payload</kbd> : optionally the fixed command or update value to send to the selected item

##### - openhab2-get

Gets an openHAB Item on an input message.

*Configuration:*
- Name : Optionally specify a name
- Controller : Select the openHAB controller
- Item : Optionally select the Item to get. If specified, it overrides the item specified in the incoming message.

*Messages accepted by NodeRED flows:*

- <kbd>msg.item</kbd> : optionally the Item to address

*Messages injected in NodeRED flows (1 channel):*

Channel 1:
The input message with addition of :
- <kbd>msg.payload</kbd> : the item object (name, label, state, ...)
