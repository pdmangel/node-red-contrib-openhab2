#node-red-contrib-openhab2
## Description

Nodes facilitating the automation of *openHAB* ( <http://http://www.openhab.org> ) items with Node-RED ( <http://nodered.org> ).
Test 123
## Installation

```
$ cd ~/.node-red
$ npm install node-red-contrib-openhab2
```

## Nodes

##### - openhab2-controller

Configuration node to configure the hostname and port of an openHAB server and to be shared by the openhab2-in and openhab2-out nodes.

##### - openhab2-in

Input node that catches the state changes of an openHAB item.
It requires the selection of an openhab2-controller and an item.

##### - openhab2-out

Input node that sends commands to an openHAB item.
It requires the selection of an openhab2-controllerand an item, and optionnaly allows the specification of a command.

