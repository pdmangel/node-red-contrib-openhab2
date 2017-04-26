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

Input node that catches the state changes of an openHAB item.
It requires the selection of an openhab2-controller and an item.

##### - openhab2-out

Output node that sends commands to an openHAB item.
It requires the selection of an openhab2-controllerand an item, and optionnaly allows the specification of a command.

