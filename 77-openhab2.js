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

		node.log(JSON.stringify(config));
		
		// this controller node handles all communication with the configured openhab server

		
		function getConnectionString() {
			var url;
			
			if ( config.protocol )
				url = config.protocol;
			else
				url = "http";
			
			url += "://";

			if ( (config.username != undefined) && (config.username.trim().length != 0) )
			{
				url += config.username.trim();
				
				if ( (config.password != undefined) && (config.password.length != 0) )
				{
					url += ":" + config.password;
				}
				url += "@";
			}
			url +=  config.host;
			
			if ( (config.port != undefined) && (config.port.trim().length != 0) )
			{
				url += ":" + config.port.trim();
			}

			if ( (config.path != undefined) && (config.path.trim().length != 0) )
			{
				var path = config.path.trim();

				path = path.replace(/^[\/]+/, '');
				path = path.replace(/[\/]+$/, '');
				
				url += "/" + path;
			}
			
node.log("url = " + url);
			return url;
		}

		function getStateOfItems() {
			
            var url = getConnectionString() + "/rest/items";
			request.get(url, function(error, response, body) {
            	// handle communication errors
        		if ( error ) {
        			node.warn("request error '" + error  + "' on '" + url + "'");
					node.emit('CommunicationError', error);
        		}
        		else if ( response.statusCode == 503 )
        		{
					// openhab not fully ready .... retry after 5 seconds
        			node.warn("response status 503 on '" + url + "' .... retry later");
					node.emit('CommunicationError', response );
					setTimeout(function() {
						getStateOfItems();
					}, 5000);
        		}
        		else if ( response.statusCode != 200 ) {
        			node.warn("response error '" + JSON.stringify(response) + "' on '" + url + "'");
					node.emit('CommunicationError', response);
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
	            getStateOfItems();
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
	    

		this.control = function(itemname, topic, payload, okCb, errCb) {
			var url;
			
            if ( topic === "ItemUpdate" )
            {
            	url = getConnectionString() + "/rest/items/" + itemname + "/state";
            	method = request.put;
            }
            else if ( topic === "ItemCommand" )
            {
            	url = getConnectionString() + "/rest/items/" + itemname;
            	method = request.post;
            }
            else
            {
            	url = getConnectionString() + "/rest/items/" + itemname;
            	method = request.get;
            }
            
			method({url: url, body: payload}, function(error, response, body) {
        		if ( error )
        		{
					node.emit('CommunicationError', error);
        			errCb("request error '" + error + "' on '" + url + "'");					
        		}
        		else if ( Math.floor(response.statusCode / 100) != 2 )
        		{
					node.emit('CommunicationError', response);
        			errCb("response error '" + JSON.stringify(response) + "' on '" + url + "'");
        		}
        		else
        		{
        			okCb(body);
        		}
        	});
			
		};

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
		
		if ( itemName != undefined ) itemName = itemName.trim();
		
		//node.log('OpenHABIn, config: ' + JSON.stringify(config));

		
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
	            node.send([{_msgid:msgid, payload: currentState, item: itemName, event: "StateEvent"}, null]);
				
			}			
		};
		
		this.processRawEvent = function(event) {
		    // inject the state in the node-red flow
		    var msgid = RED.util.generateId();
            node.send([null, {_msgid:msgid, payload: event, item: itemName, event: "RawEvent"}]);
			
		};
		
		node.context().set("currentState", "?");
		openhabController.addListener(itemName + '/RawEvent', node.processRawEvent);
		openhabController.addListener(itemName + '/StateEvent', node.processStateEvent);
		node.refreshNodeStatus();		
				
		/* ===== Node-Red events ===== */
		this.on("input", function(msg) {
			if (msg != null) {
				
			};
		});
		this.on("close", function() {
			node.log('close');
			openhabController.removeListener(itemName + '/StateEvent', node.processStateEvent);
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
			var commError = node.context().get("CommunicationError");
			var commStatus = node.context().get("CommunicationStatus");
			
			node.status({
				fill: 	(commError.length == 0 ) ? "green" : "red" ,
				shape: 	(commStatus == "ON" ) ? "dot" : "ring",
				text:	(commError.length != 0) ? commError : commStatus});
			
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
			node.context().set("CommunicationError", JSON.stringify(error));
			
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
		node.context().set("CommunicationStatus", "?");
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
	* Sends outgoing commands or update from
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

			// if a payload is specified in the node's configuration, it overrides the payload specified in the message
            var payload = (config.payload && (config.payload.length != 0)) ? config.payload : msg.payload;
            var topic = (config.topic && (config.topic.length != 0)) ? config.topic : msg.topic;
			
            if ( payload != undefined )
			{
            	// payload conversion
				if ( payload == "on"  )
					payload = "ON";
				else if ( payload == "off" )
					payload = "OFF";
				else
					payload = "" + payload;
	            //node.log("payload = " + payload);
				
	            // execute the appropriate http POST to send the command to openHAB
				// and update the node's status according to the http response
				
				openhabController.control(config.itemname, topic, payload,
									function(body){
										// no body expected for a command or update
	                					node.status({fill:"green", shape: "dot", text: " "});
									},
									function(err) {
	                					node.status({fill:"red", shape: "ring", text: err});
	                					node.warn(err);
									}
				);
	            
			}
			else
			{
				// no payload specified !
                node.status({fill:"red", shape: "ring", text: "no payload specified"});
				node.warn('onInput: no payload specified');
			}

		});
		this.on("close", function() {
			node.log('close');
		});
	}
	//
	RED.nodes.registerType("openhab2-out", OpenHABOut);

	/**
	* ====== openhab2-get ===================
	* Gets the item data when
	* messages received via node-red flows
	* =======================================
	*/
	function OpenHABGet(config) {
		RED.nodes.createNode(this, config);
		this.name = config.name;
		var openhabController = RED.nodes.getNode(config.controller);
		var node = this;
		
		// handle incoming node-red message
		this.on("input", function(msg) {

			openhabController.control(config.itemname, null, null,
								function(body){
									// no body expected for a command or update
                					node.status({fill:"green", shape: "dot", text: " "});
                					msg.payload = JSON.parse(body);
                					node.send(msg);
								},
								function(err) {
                					node.status({fill:"red", shape: "ring", text: err});
                					node.warn(err);
								}
			);
		});
		this.on("close", function() {
			node.log('close');
		});
	}
	//
	RED.nodes.registerType("openhab2-get", OpenHABGet);

    /**
     * ====== openhab2-switch ===================
     * Gets the item data when
     * messages received via node-red flows
     * =======================================
     */
    function OpenHABSwitch(config) {
        RED.nodes.createNode(this, config);
        this.name = config.name;
        var openhabController = RED.nodes.getNode(config.controller);
        var node = this;
        this.rules = config.rules || [];
        this.checkall = config.checkall || "true";
        this.previousValue = null;
        this.jsonata = require('jsonata');

        this.operators = {
            'eq': function(a, b) { return a == b; },
            'neq': function(a, b) { return a != b; },
            'lt': function(a, b) { return a < b; },
            'lte': function(a, b) { return a <= b; },
            'gt': function(a, b) { return a > b; },
            'gte': function(a, b) { return a >= b; },
            'btwn': function(a, b, c) { return a >= b && a <= c; },
            'cont': function(a, b) { return (a + "").indexOf(b) != -1; },
            'regex': function(a, b, c, d) { return (a + "").match(new RegExp(b,d?'i':'')); },
            'true': function(a) { return a === true; },
            'false': function(a) { return a === false; },
            'null': function(a) { return (typeof a == "undefined" || a === null); },
            'nnull': function(a) { return (typeof a != "undefined" && a !== null); },
            'else': function(a) { return a === true; },
            'ison': function(a) { return a == "ON"; },
            'isoff': function(a) { return a == "OFF"; },
            'isopen': function(a) { return a == "OPEN"; },
            'isclosed': function(a) { return a == "CLOSED"; }
        };


        var valid = true;
        for (var i = 0; i < this.rules.length; i += 1) {
            var rule = this.rules[i];
            if (!rule.vt) {
                if (!isNaN(Number(rule.v))) {
                    rule.vt = 'num';
                } else {
                    rule.vt = 'str';
                }
            }
            if (rule.vt === 'num') {
                if (!isNaN(Number(rule.v))) {
                    rule.v = Number(rule.v);
                }
            } else if (rule.vt === "jsonata") {
                try {
                    rule.v = this.jsonata(rule.v);
                } catch (err) {
                    this.error("Invalid expression %s", {error: err.message});
                    valid = false;
                }
            }
            if (typeof rule.v2 !== 'undefined') {
                if (!rule.v2t) {
                    if (!isNaN(Number(rule.v2))) {
                        rule.v2t = 'num';
                    } else {
                        rule.v2t = 'str';
                    }
                }
                if (rule.v2t === 'num') {
                    rule.v2 = Number(rule.v2);
                } else if (rule.v2t === 'jsonata') {
                    try {
                        rule.v2 = this.jsonata(rule.v2);
                    } catch (err) {
                        this.error("Invalid expression %s", {error: err.message});
                        valid = false;
                    }
                }
            }
        }

        if (!valid) {
            return;
        }

        // handle incoming node-red message
        this.on("input", function(msg) {
            openhabController.control(config.itemname, null, null,
                function(body){
                    // no body expected for a command or update
                    node.status({fill:"green", shape: "dot", text: " "});
                    var fetchedPayload = JSON.parse(body);
                    var test = fetchedPayload.state;

                    var onward = [];
                    var elseflag = true;
                    for (var i = 0; i < node.rules.length; i += 1) {
                        var rule = node.rules[i];
                        var v1, v2;
                        if (rule.vt === 'prev') {
                            v1 = node.previousValue;
                        } else if (rule.vt === 'jsonata') {
                            try {
                                v1 = rule.v.evaluate({msg: msg});
                            } catch (err) {
                                node.error("Invalid expression %s", {error: err.message});
                                return;
                            }
                        } else {
                            try {
                                v1 = RED.util.evaluateNodeProperty(rule.v, rule.vt, node, msg);
                            } catch (err) {
                                v1 = undefined;
                            }
                        }
                        v2 = rule.v2;
                        if (rule.v2t === 'prev') {
                            v2 = node.previousValue;
                        } else if (rule.v2t === 'jsonata') {
                            try {
                                v2 = rule.v2.evaluate({msg: msg});
                            } catch (err) {
                                node.error("Invalid expression %s", {error: err.message});
                                return;
                            }
                        } else if (typeof v2 !== 'undefined') {
                            try {
                                v2 = RED.util.evaluateNodeProperty(rule.v2, rule.v2t, node, msg);
                            } catch (err) {
                                v2 = undefined;
                            }
                        }
                        if (rule.t == "else") {
                            test = elseflag;
                            elseflag = true;
                        }
                        if (node.operators[rule.t](test, v1, v2, rule.case)) {
                            onward.push(msg);
                            elseflag = false;
                            if (node.checkall == "false") {
                                break;
                            }
                        } else {
                            onward.push(null);
                        }
                    }
                    node.previousValue = fetchedPayload.state;
                    node.send(onward);
                },
                function(err) {
                    node.status({fill:"red", shape: "ring", text: err});
                    node.warn(err);
                }
            );
        });
        this.on("close", function() {
            node.log('close');
        });
    }
    //
    RED.nodes.registerType("openhab2-switch", OpenHABSwitch);
} 