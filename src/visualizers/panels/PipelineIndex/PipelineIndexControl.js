/*globals define, WebGMEGlobal*/
/*jshint browser: true*/

define([
    'js/Constants',
    'js/NodePropertyNames'
], function (
    CONSTANTS,
    nodePropertyNames
) {

    'use strict';

    var PipelineIndexControl;

    PipelineIndexControl = function (options) {

        this._logger = options.logger.fork('Control');

        this._client = options.client;

        // Initialize core collections and variables
        this._widget = options.widget;

        this._currentNodeId = null;
        this._embedded = options.embedded;

        this._initWidgetEventHandlers();
        this._logger.debug('ctor finished');
    };

    PipelineIndexControl.prototype._initWidgetEventHandlers = function () {
        this._widget.deletePipeline = id => {
            var node = this._client.getNode(id),
                name = node.getAttribute('name'),
                msg = `Deleting pipeline "${name}"`;

            // Change the current active object
            this._client.startTransaction(msg);
            this._client.delMoreNodes([id]);
            this._client.completeTransaction();
        };

        this._widget.setName = (id, name) => {
            var oldName = this._client.getNode(id).getAttribute('name'),
                msg = `Renaming Pipeline: "${oldName}" -> "${name}"`;

            if (oldName !== name && !/^\s*$/.test(name)) {
                this._client.startTransaction(msg);
                this._client.setAttributes(id, 'name', name);
                this._client.completeTransaction();
            }
        };
    };

    /* * * * * * * * Visualizer content update callbacks * * * * * * * */
    // One major concept here is with managing the territory. The territory
    // defines the parts of the project that the visualizer is interested in
    // (this allows the browser to then only load those relevant parts).
    PipelineIndexControl.prototype.selectedObjectChanged = function (nodeId) {
        this._logger.debug('activeObject nodeId \'' + nodeId + '\'');

        // Remove current territory patterns
        if (this._currentNodeId) {
            this._client.removeUI(this._territoryId);
        }

        this._currentNodeId = nodeId;

        if (typeof this._currentNodeId === 'string') {
            // Put new node's info into territory rules
            this._selfPatterns = {};
            this._selfPatterns[nodeId] = {children: 1};
            this._territoryId = this._client.addUI(this, this._eventCallback.bind(this));

            // Update the territory
            this._client.updateTerritory(this._territoryId, this._selfPatterns);
        }
    };

    // This next function retrieves the relevant node information for the widget
    PipelineIndexControl.prototype._getObjectDescriptor = function (nodeId) {
        var node = this._client.getNode(nodeId),
            objDescriptor;

        if (node) {
            objDescriptor = {
                id: undefined,
                name: undefined,
                parentId: undefined,
                thumbnail: node.getAttribute('thumbnail'),
                executionCount: node.getMemberIds('executions').length
            };

            objDescriptor.id = node.getId();
            objDescriptor.name = node.getAttribute(nodePropertyNames.Attributes.name);
            objDescriptor.parentId = node.getParentId();
        }

        return objDescriptor;
    };

    /* * * * * * * * Node Event Handling * * * * * * * */
    PipelineIndexControl.prototype._eventCallback = function (events) {
        var i = events ? events.length : 0,
            event;

        this._logger.debug('_eventCallback \'' + i + '\' items');

        while (i--) {
            event = events[i];
            switch (event.etype) {
            case CONSTANTS.TERRITORY_EVENT_LOAD:
                this._onLoad(event.eid);
                break;
            case CONSTANTS.TERRITORY_EVENT_UPDATE:
                this._onUpdate(event.eid);
                break;
            case CONSTANTS.TERRITORY_EVENT_UNLOAD:
                this._onUnload(event.eid);
                break;
            default:
                break;
            }
        }

        this._logger.debug('_eventCallback \'' + events.length + '\' items - DONE');
    };

    PipelineIndexControl.prototype._onLoad = function (gmeId) {
        if (gmeId !== this._currentNodeId) {
            var description = this._getObjectDescriptor(gmeId);
            this._widget.addNode(description);
        }
    };

    PipelineIndexControl.prototype._onUpdate = function (gmeId) {
        if (gmeId !== this._currentNodeId) {
            var description = this._getObjectDescriptor(gmeId);
            this._widget.updateNode(description);
        }
    };

    PipelineIndexControl.prototype._onUnload = function (gmeId) {
        this._widget.removeNode(gmeId);
    };

    PipelineIndexControl.prototype._stateActiveObjectChanged = function (model, activeObjectId) {
        if (this._currentNodeId !== activeObjectId) {
            this.selectedObjectChanged(activeObjectId);
        }
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    PipelineIndexControl.prototype.destroy = function () {
        this._detachClientEventListeners();
        this._removeToolbarItems();
    };

    PipelineIndexControl.prototype._attachClientEventListeners = function () {
        this._detachClientEventListeners();
        if (!this._embedded) {
            WebGMEGlobal.State.on('change:' + CONSTANTS.STATE_ACTIVE_OBJECT, this._stateActiveObjectChanged, this);
        }
    };

    PipelineIndexControl.prototype._detachClientEventListeners = function () {
        if (!this._embedded) {
            WebGMEGlobal.State.off('change:' + CONSTANTS.STATE_ACTIVE_OBJECT, this._stateActiveObjectChanged);
        }
    };

    PipelineIndexControl.prototype.onActivate = function () {
        this._attachClientEventListeners();
        this._displayToolbarItems();

        if (typeof this._currentNodeId === 'string') {
            WebGMEGlobal.State.registerSuppressVisualizerFromNode(true);
            WebGMEGlobal.State.registerActiveObject(this._currentNodeId);
            WebGMEGlobal.State.registerSuppressVisualizerFromNode(false);
        }
    };

    PipelineIndexControl.prototype.onDeactivate = function () {
        this._detachClientEventListeners();
        this._hideToolbarItems();
    };

    /* * * * * * * * * * Updating the toolbar * * * * * * * * * */
    PipelineIndexControl.prototype._displayToolbarItems = function () {

        if (this._toolbarInitialized === true) {
            for (var i = this._toolbarItems.length; i--;) {
                this._toolbarItems[i].show();
            }
        } else {
            this._initializeToolbar();
        }
    };

    PipelineIndexControl.prototype._hideToolbarItems = function () {

        if (this._toolbarInitialized === true) {
            for (var i = this._toolbarItems.length; i--;) {
                this._toolbarItems[i].hide();
            }
        }
    };

    PipelineIndexControl.prototype._removeToolbarItems = function () {

        if (this._toolbarInitialized === true) {
            for (var i = this._toolbarItems.length; i--;) {
                this._toolbarItems[i].destroy();
            }
        }
    };

    PipelineIndexControl.prototype._initializeToolbar = function () {
        this._toolbarItems = [];
        this._toolbarInitialized = true;
    };

    return PipelineIndexControl;
});