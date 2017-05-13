/*

  openHAB nodes for IBM's Node-Red
  https://github.com/pdmangel/node-red-contrib-openhab2
  (c) 2017, Peter De Mangelaere <peter.demangelaere@gmail.com>

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
  
*/
var EventSource = require('@joeybaker/eventsource');
var request = require('request');

module.exports = function(RED) {

	
	/**
	* ====== openhab2-controller ================
	* Holds the hostname and port of the  
	* openHAB server
	* ===========================================
	*/
	function OpenHABControllerNode(config) {
		RED.nodes.createNode(this, config);

		var node = this;

		// this controller node handles all communication with the configured openhab server
		
		function getConnectionString() {
			return "http://" + config.host + ":" + config.port;
		}

		function getItems() {
			
            var url = getConnectionString() + "/rest/items";
			request.get(url, function(error, response, body) {
            	// handle communication errors
        		if ( error ) {
        			node.warn("request error '" +  + "' on '" + url + "'");
					node.emit('CommunicationError', error);
        		}
        		else if ( response.statusCode == 503 )
        		{
					// openhab not fully ready .... retry after 5 seconds
        			node.warn("response status 503 on '" + url + "' .... retry later");
					node.emit('CommunicationError', "" + response.statusCode );
					setTimeout(function() {
						getItems();
					}, 5000);
        		}
        		else if ( response.statusCode != 200 ) {
        			node.warn("response error '" + JSON.stringify(response) + "' on '" + url + "'");
					node.emit('CommunicationError', JSON.stringify(response));
        		}
        		else {
        			// update the registered nodes with item state
    				node.emit('CommunicationStatus', "ON");
    				
		    		var items = JSON.parse(body);
		    		
		    		items.forEach(function(item) {
						node.emit(item.name + "/StateEvent", {type: "ItemStateEvent", state: item.state});
		    		});
		    		
        		}
           	});
			
		}
		
		function startEventSource() {
			
			// register for all item events
			
			node.es= new EventSource(getConnectionString() + "/rest/events?topics=smarthome/items", {});
			
			// handle the 'onopen' event
			
			node.es.onopen = function(event) {

				// get the current state of all items
	            getItems();
	       	};

			// handle the 'onmessage' event
			
	       	node.es.onmessage = function(msg) {
			    //node.log(msg.data);
				try
				{
        			// update the node status with the Item's new state
				    msg = JSON.parse(msg.data);
				    msg.payload = JSON.parse(msg.payload);
				    
				    var item = msg.topic.substring(("smarthome/items/").length, msg.topic.lastIndexOf('/'));
				    
				    node.emit(item + "/RawEvent", msg);
				    node.emit("RawEvent", msg);
				    
				    if ( (msg.type == "ItemStateEvent") || (msg.type == "ItemStateChangedEvent") )
						node.emit(item + "/StateEvent", {type: msg.type, state: msg.payload.value});
				}
				catch(e)
				{
					// report an unexpected error
					node.error("Unexpected Error : " + e)
				}
				
			};
			
			// handle the 'onerror' event
			
	       	node.es.onerror = function(err) {
				if( err.type && (JSON.stringify(err.type) === '{}') )
					return; // ignore
	       		
	       		node.warn('ERROR ' +	JSON.stringify(err));
				node.emit('CommunicationError', JSON.stringify(err));
				
				
				if ( err.status )
				{
					if ( (err.status == 503) || (err.status == "503") || (err.status == 404) || (err.status == "404") )
						// the EventSource object has given up retrying ... retry reconnecting after 10 seconds
						
						node.es.close();
						delete node.es;
						
						node.emit('CommunicationStatus', "OFF");

						setTimeout(function() {
							startEventSource();
						}, 10000);
				}
				else if ( err.type && err.type.code )
				{
					// the EventSource object is retrying to reconnect
				}
				else
				{
					// no clue what the error situation is
				}
			  };

		}
		
	    startEventSource();		
	    
		this.on("close", function() {
			node.log('close');
			node.es.close();
			node.emit('CommunicationStatus', "OFF");
		});

	}
    RED.nodes.registerType("openhab2-controller", OpenHABControllerNode);

    // start a web service for enabling the node configuration ui to query for available openHAB items
    
    RED.httpNode.get("/openhab2/items/:host/:port",function(req, res, next) {
    	
    	var controllerAddress = req.params.host + ":" + req.params.port;

    	var url = "http://" + controllerAddress + "/rest/items";
        request.get(url, function(error, response, body) {
    		if ( error ) {
    			res.send("request error '" + JSON.stringify(error) + "' on '" + url + "'");
    		}
    		else if ( response.statusCode != 200 ) {
    			res.send("response error '" + JSON.stringify(response) + "' on '" + url + "'");
    		}
    		else {
    			res.send(body);
    		}
       	});
    	

    });
	   	
	
	/**
	* ====== openhab2-in ========================
	* Handles incoming openhab2 events, injecting 
	* json into node-red flows
	* ===========================================
	*/
	function OpenHABIn(config) {
		RED.nodes.createNode(this, config);
		this.name = config.name;
		var node = this;
		var openhabController = RED.nodes.getNode(config.controller);
		var itemName = config.itemname;
		var itemLabel = config.itemlabel;
		
		if ( itemName != undefined ) itemName = itemName.trim();
		
		//node.log('OpenHABIn, config: ' + JSON.stringify(config));

		// starts an EventSource to listen to openHAB2's Server-Sent Events 'statechanged' for the selected Item
		
		this.refreshNodeStatus = function() {
			var currentState = node.context().get("currentState");
			
		    if ( currentState == null )
		        node.status({fill:"yellow", shape: "ring", text: "state:" + currentState});		    	
		    else if ( currentState == "ON" )
		        node.status({fill:"green", shape: "dot", text: "state:" + currentState});
		    else if ( currentState == "OFF" )
		        node.status({fill:"green", shape: "ring", text: "state:" + currentState});
		    else
		        node.status({fill:"blue", shape: "ring", text: "state:" + currentState});
		};
		
		this.processStateEvent = function(event) {
			
			var currentState = node.context().get("currentState");
			
			if ( (event.state != currentState) && (event.state != "null") )
			{
				// update node's context variable
				currentState = event.state;
				node.context().set("currentState", currentState);
				
				// update node's visual status
				node.refreshNodeStatus();
				
			    // inject the state in the node-red flow
			    var msgid = RED.util.generateId();
	            node.send({_msgid:msgid, payload: currentState, item: itemName, event: "StateEvent"});
				
			}			
		};
		
		this.processRawEvent = function(event) {
		    // inject the state in the node-red flow
		    var msgid = RED.util.generateId();
            node.send({_msgid:msgid, payload: event, item: itemName, event: "RawEvent"});
			
		};
		
		if ( config.output == "StateEvent")
		{
			node.currentState = "?";
			
			openhabController.addListener(itemName + '/StateEvent', node.processStateEvent);
			node.refreshNodeStatus();
		}
		else if ( config.output == "RawEvent")
		{
			openhabController.addListener(itemName + '/RawEvent', node.processRawEvent);
			node.status({});
		}
		
		

		/* ===== Node-Red events ===== */
		this.on("input", function(msg) {
			if (msg != null) {
				
			};
		});
		this.on("close", function() {
			node.log('close');
			if ( config.output == "StateEvent")
				openhabController.removeListener(itemName + '/StateEvent', node.processStateEvent);
			else if ( config.output == "RawEvent")
				openhabController.removeListener(itemName + '/RawEvent', node.processRawEvent);
		});
		
	}
	//
	RED.nodes.registerType("openhab2-in", OpenHABIn);
	
	
	/**
	* ====== openhab2-monitor ===================
	* Monitors connection status and errors of
	* the associated openhab2-controller
	* ===========================================
	*/
	function OpenHABMonitor(config) {
		RED.nodes.createNode(this, config);
		this.name = config.name;
		var node = this;
		var openhabController = RED.nodes.getNode(config.controller);
		
		this.refreshNodeStatus = function() {
			var commmError = node.context().get("CommunicationError");
			var commmStatus = node.context().get("CommunicationStatus");
			
			node.status({
				fill: 	(commmError.length == 0 ) ? "green" : "red" ,
				shape: 	(commmStatus == "ON" ) ? "dot" : "ring",
				text:	commmError});
			
		};
		
		this.processCommStatus = function(status) {
			
			// update node's context variable

			node.context().set("CommunicationStatus", status);
			if ( status == "ON" )
				node.context().set("CommunicationError", "");
			
			// update node's visual status
			node.refreshNodeStatus();
			
		    // inject the state in the node-red flow (channel 1)
		    var msgid = RED.util.generateId();
            node.send([{_msgid:msgid, payload: status, event: "CommunicationStatus"}, null, null]);
		};
		
		this.processCommError = function(error) {
			
			// update node's context variable
			node.context().set("CommunicationError", "" + error);
			
			// update node's visual status
			node.refreshNodeStatus();
			
		    // inject the error in the node-red flow (channel 2)
		    var msgid = RED.util.generateId();
            node.send([null, {_msgid:msgid, payload: error, event: "CommunicationError"}, null]);
		};

		this.processRawEvent = function(event) {
		    // inject the state in the node-red flow (channel 3)
		    var msgid = RED.util.generateId();
            node.send([null, null, {_msgid:msgid, payload: event, event: "RawEvent"}]);
			
		};
		
		openhabController.addListener('CommunicationStatus', node.processCommStatus);
		openhabController.addListener('CommunicationError', node.processCommError);
		openhabController.addListener('RawEvent', node.processRawEvent);
		node.context().set("CommunicationError", "");
		node.context().set("CommunicationStatus", "");
		node.refreshNodeStatus();

		/* ===== Node-Red events ===== */
		this.on("input", function(msg) {
			if (msg != null) {
				
			};
		});
		this.on("close", function() {
			node.log('close');
			openhabController.removeListener('CommunicationStatus', node.processCommStatus);
			openhabController.removeListener('CommunicationError', node.processCommError);
			openhabController.removeListener('RawEvent', node.processRawEvent);
		});
		
	}
	//
	RED.nodes.registerType("openhab2-monitor", OpenHABMonitor);
	
	
	/**
	* ====== openhab2-out ===================
	* Sends outgoing commands from
	* messages received via node-red flows
	* =======================================
	*/
	function OpenHABOut(config) {
		RED.nodes.createNode(this, config);
		this.name = config.name;
		var openhabController = RED.nodes.getNode(config.controller);
		var node = this;
		
		//node.log('new OpenHABOut, config: ' + JSON.stringify(config));

		// handle incoming node-red message
		this.on("input", function(msg) {
			
			// if a command is specified in the node's configuration, it overrides the command specified in the message
            var command = (config.command && (config.command.length != 0)) ? config.command : msg.payload;
			
            if ( command != undefined )
			{
            	// command conversion
				if ( (command == "on") || (command == "1") || (command == 1) || (command == true) )
					command = "ON";
				else if ( (command == "off") || (command == "0") || (command == 0) || (command == false) )
					command = "OFF";
				
	            //node.log("COMMAND = " + command);
				
	            // execute the appropriate http POST to send the command to openHAB
				// and update the node's status according to the http response
				
				var url = openhabController.getConnectionString() + "/rest/items/" + config.itemname;
	            
	            request.post({url: url, body: command}, function(error, response, body) {
	        		if ( error ) {
	                    node.status({fill:"red", shape: "ring", text: JSON.stringify(error)});
	        			node.warn("request error '" +  + "' on '" + url + "'");
	        		}
	        		else if ( response.statusCode != 200 ) {
	                    node.status({fill:"red", shape: "ring", text: JSON.stringify(response)});
	        			node.warn("response error '" + JSON.stringify(response) + "' on '" + url + "'");
	        		}
	        		else {
	                    node.status({fill:"green", shape: "ring", text: "OK"});
	        			
	        		}
	        	});
			}
			else
			{
				// no command specified !
                node.status({fill:"red", shape: "ring", text: "no command specified"});
				node.warn('onInput: no command specified');
			}

		});
		this.on("close", function() {
			node.log('close');
		});
	}
	//
	RED.nodes.registerType("openhab2-out", OpenHABOut);
} 