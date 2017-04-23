/*

  openHAB nodes for IBM's Node-Red
  https://github.com/pdmangel/node-red-contrib-openhab2
  (c) 2016, Peter De Mangelaere <peter.demangelaere@gmail.com>

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
		this.errorCount = 0;

		var node = this;

		node.log("new OpenHABControllerNode, config: " + JSON.stringify(config));
		
		this.getConnectionString = function() {
			return "http://" + config.host + ":" + config.port;
		}

	}
    RED.nodes.registerType("openhab2-controller", OpenHABControllerNode);

    // start a web service for enabling the node configuration ui to query available devices
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
		
		node.log('OpenHABIn, config: ' + JSON.stringify(config));

		function startEventSource() {
			node.es = new EventSource(openhabController.getConnectionString() + "/rest/events?topics=smarthome/items/" + itemName + "/statechanged", {});
			
			node.es.onmessage = function(e) {
			    node.log(e.data);
				try
				{
				    var msg = JSON.parse(e.data);
				    var payload = JSON.parse(msg.payload);
				    
				    if ( payload.value == "ON" )
				        node.status({fill:"green", shape: "dot", text: "state:" + payload.value});
				    else if ( payload.value == "OFF" )
				        node.status({fill:"green", shape: "ring", text: "state:" + payload.value});
				    else
				        node.status({fill:"blue", shape: "ring", text: "state:" + payload.value});

				    var msgid = RED.util.generateId();
		            node.send({_msgid:msgid, topic: "statechanged", payload:payload.value, item: itemName});
				}
				catch(e)
				{
	                node.status({fill:"red", shape: "ring", text: "Unexpected Error : " + e.msg});
					node.error("Unexpected Error : " + e.msg)
				}
				
			};
			
			node.es.onopen = function(event) {
	            node.status({fill:"blue", shape: "ring", text: "?"});

	            var url = openhabController.getConnectionString() + "/rest/items/" + itemName;
	            
	            request.get(url, function(error, response, body) {
	        		if ( error ) {
	                    node.status({fill:"red", shape: "ring", text: JSON.stringify(error)});
	        			node.warn("request error '" +  + "' on '" + url + "'");
	        		}
	        		else if ( response.statusCode != 200 ) {
	                    node.status({fill:"red", shape: "ring", text: JSON.stringify(response)});
	        			node.warn("response error '" + JSON.stringify(response) + "' on '" + url + "'");
	        		}
	        		else {
			    		var payload = JSON.parse(body);
			    		
					    if ( payload.state == "ON" )
					        node.status({fill:"green", shape: "dot", text: "state:" + payload.state});
					    else if ( payload.state == "OFF" )
					        node.status({fill:"green", shape: "ring", text: "state:" + payload.state});
					    else
					        node.status({fill:"blue", shape: "ring", text: "state:" + payload.state});

					    var msgid = RED.util.generateId();
			            node.send({_msgid:msgid, topic: "state", payload:payload.state, item: itemName});
	        		}
	           	});
	       	};

			
	       	node.es.onerror = function(err) {
				node.warn('ERROR ' +	JSON.stringify(err));
				
				if ( err.status )
				{
					node.status({fill:"red", shape: "dot", text: "Connection Status: " + err.status});
					if ( (err.status == 503) || (err.status == "503") || (err.status == 404) || (err.status == "404") )
						// retry
						setTimeout(function() {
							startEventSource();
						}, 10000);
				}
				else if ( err.type && err.type.code )
					node.status({fill:"red", shape: "ring", text: "Connection Error: " + err.type.code});
				else
			        node.status({fill:"red", shape: "ring", text: "Unexpected Connection Error"});
			  };

		}
		
		startEventSource();
		
		node.status({fill:"red", shape: "ring", text: "?"});
		

		/* ===== Node-Red events ===== */
		this.on("input", function(msg) {
			if (msg != null) {
				
			};
		});
		this.on("close", function() {
			node.log('close');
			node.es.close();
		});
		
	}
	//
	RED.nodes.registerType("openhab2-in", OpenHABIn);
	
	
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

		
		node.log('new OpenHABOut, config: ' + JSON.stringify(config));

		this.on("input", function(msg) {
			
            var url = openhabController.getConnectionString() + "/rest/items/" + config.itemname;
            
			var command = (config.command && (config.command.length != 0)) ? config.command : msg.payload;
			
            if ( command != undefined )
			{
				if ( (msg.payload == "on") || (msg.payload == "1") || (msg.payload == 1) || (msg.payload == true) )
					command = "ON";
				else if ( (msg.payload == "off") || (msg.payload == "0") || (msg.payload == 0) || (msg.payload == false) )
					command = "OFF";
			}
			else
			{
                node.status({fill:"red", shape: "ring", text: "no command specified"});
				node.warn('onInput: no command specified');
				return;
			}

            node.log("COMMAND = " + command);
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
                    node.status({fill:"green", shape: "ring", text: ""});
        			
        		}
        	});
		});
		this.on("close", function() {
			node.log('close');
		});
	}
	//
	RED.nodes.registerType("openhab2-out", OpenHABOut);
} 