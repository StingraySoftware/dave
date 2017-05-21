var tabPanels = [];

function addTabPanel(navBarList, panelContainer){
  tab = new TabPanel("Tab_" + tabPanels.length, "TabPanelTemplate", "NavItem_" + tabPanels.length, theService, navBarList, panelContainer);
  tabPanels.push(tab);
}

function TabPanel (id, classSelector, navItemClass, service, navBarList, panelContainer) {

  var currentObj = this;

  //TAB_PANEL ATTRIBUTES
  this.id = id;
  this.classSelector = classSelector;
  this.navItemClass = navItemClass;
  this.service = service;
  this.$html = cloneHtmlElement(id, classSelector);
  this.$navItem = $('<li><a class="' + navItemClass + '" href="#">Tab ' + tabPanels.length + '</a></li>')

  this.actionsHistory = [];
  this.prevAction = null;

  this.projectConfig = new ProjectConfig();

  //TAB_PANEL METHODS AND EVENTS HANDLERS
  this.setTitle = function ( title ) {
    this.$navItem.find("." + this.navItemClass).html(title);
    this.addCloseButton();
    log("TabPanel setTitle id: " + this.id + " title: " + title);
  }

  this.prepareButton = function ( buttonElem, panel ) {
    buttonElem.button().bind("click", function( event ) {
      currentObj.wfSelector.find("li").removeClass('active');
      $(this).parent().addClass("active");
      currentObj.setCurrentPanel(panel);
    });
  }

  this.setCurrentPanel = function ( panel ) {
    this.toolPanel.showPanel(panel);
  }

  this.show = function () {
    this.$navItem.parent().find(".active").removeClass("active");
    this.$navItem.addClass("active");
    $(".TabPanel").hide();
    this.$html.show();
    log("TabPanel shown id: " + this.id);
  }

  this.addCloseButton = function () {
    var closeTabBtn = $('<i class="fa fa-times closeIcon closeTabPanel" aria-hidden="true"></i>')
    this.$navItem.find("." + this.navItemClass).append(closeTabBtn);
    closeTabBtn.bind("click", function( event ) {
      currentObj.close();
    });
  }

  this.close = function () {
    log("TabPanel closed id: " + this.id);
    removeTab(this.id);
  }

  this.onDatasetChanged = function ( filenames, selectorKey ) {

    if (filenames.length == 1) {

      currentObj.projectConfig.setFiles(selectorKey, [], filenames[0]);
      waitingDialog.show('Getting file schema: ' + filenames[0]);
      log("onDatasetChanged " + selectorKey + ": " + filenames[0]);
      if (selectorKey == "SRC") {
        currentObj.service.get_dataset_schema(currentObj.projectConfig.filename, currentObj.onSrcSchemaChanged, currentObj.onSchemaError, null);
      } else if (selectorKey == "BCK") {
        currentObj.service.get_dataset_schema(currentObj.projectConfig.bckFilename, currentObj.onBckSchemaChanged);
      } else if (selectorKey == "GTI") {
        currentObj.service.get_dataset_schema(currentObj.projectConfig.gtiFilename, currentObj.onGtiSchemaChanged);
      } else if ((selectorKey == "RMF") && currentObj.projectConfig.hasSchema()) {
        waitingDialog.show('Applying RMF: ' + filenames[0]);
        currentObj.projectConfig.setFile("RMF", filenames[0]);
        currentObj.service.apply_rmf_file_to_dataset(currentObj.projectConfig.filename, currentObj.projectConfig.rmfFilename, currentObj.onRmfApplied);
      } else if ((selectorKey == "ARF") && currentObj.projectConfig.hasSchema()) {
        waitingDialog.show('Applying ARF: ' + filenames[0]);
        currentObj.projectConfig.setFile("ARF", filenames[0]);
        currentObj.onArfUploaded();
      }

    } else if (filenames.length > 1){

      currentObj.projectConfig.setFiles(selectorKey, filenames, filenames[0]);
      var params = {};
      if (selectorKey == "SRC") {
        params = { filename: currentObj.projectConfig.filename, filenames: currentObj.projectConfig.filenames, currentFile: 1, onSchemaChanged:currentObj.onSrcSchemaChanged };
      } else if (selectorKey == "BCK") {
        params = { filename: currentObj.projectConfig.bckFilename, filenames: currentObj.projectConfig.bckFilenames, currentFile: 1, onSchemaChanged:currentObj.onBckSchemaChanged };
      } else if (selectorKey == "GTI") {
        params = { filename: currentObj.projectConfig.gtiFilename, filenames: currentObj.projectConfig.gtiFilenames, currentFile: 1, onSchemaChanged:currentObj.onGtiSchemaChanged };
      } else if (selectorKey == "RMF") {
        log("onDatasetChanged: RMF files doesn't support multiple selection!");
        return;
      } else if (selectorKey == "ARF") {
        log("onDatasetChanged: ARF files doesn't support multiple selection!");
        return;
      }
      currentObj.onSchemaChangedMultipleFiles(null, params);

    } else {
      log("onDatasetChanged " + selectorKey + ": No selected files..");
    }

  }

  this.onLcDatasetChanged = function ( filenames, selectorKey ) {

    if (filenames.length == 1) {

      log("onLcDatasetChanged " + selectorKey + ": " + filenames[0]);
      currentObj.projectConfig.setFile(selectorKey, filenames[0]);
      if (currentObj.projectConfig.hasSchema()) {

        currentObj.outputPanel.addLightcurveAndPdsPlots(selectorKey, filenames[0], "", "", "RATE", "RATE", currentObj.projectConfig);

        currentObj.outputPanel.tryAddDividedLightCurve("LCB", "LCA", "B/A", currentObj.projectConfig);
        currentObj.outputPanel.tryAddDividedLightCurve("LCD", "LCC", "D/C", currentObj.projectConfig);
      }

      waitingDialog.hide();

    } else if (filenames.length > 1){
      log("onLcDatasetChanged " + selectorKey + ": Multifile selection not supported yet..");
      waitingDialog.hide();
    } else {
      log("onLcDatasetChanged " + selectorKey + ": No selected files..");
      waitingDialog.hide();
    }

  }

  this.onSrcSchemaChanged = function ( schema, params ) {
    log("onSrcSchemaChanged:" + schema);
    currentObj.onSchemaChangedWithKey("SRC", schema, params);
  }

  this.onBckSchemaChanged = function ( schema, params ) {
    log("onBckDatasetChanged:" + schema);
    currentObj.onSchemaChangedWithKey("BCK", schema, params);
  }

  this.onGtiSchemaChanged = function ( schema, params ) {
    log("onGtiSchemaChanged:" + schema);
    currentObj.onSchemaChangedWithKey("GTI", schema, params);
  }

  this.onRmfApplied = function ( result ) {
    result = JSON.parse(result);
    if (!isNull(result) && result.length > 0){
      log("onRmfApplied: Getting new shema..");

      currentObj.projectConfig.setRmfData(result);

      currentObj.service.get_dataset_schema(currentObj.projectConfig.filename, function( schema, params ){

        log("onRmfApplied: Success!");
        var jsonSchema = JSON.parse(schema);
        currentObj.projectConfig.setSchema(jsonSchema);
        currentObj.toolPanel.onRmfDatasetUploaded(jsonSchema);
        currentObj.outputPanel.addRmfPlots(currentObj.projectConfig);
        waitingDialog.hide();

      }, currentObj.onSchemaError, null);
    } else {
      log("onRmfApplied error:" + JSON.stringify(result));
      waitingDialog.hide();
    }
  }

  this.onArfUploaded = function () {
    log("onArfUploaded:");
    currentObj.outputPanel.addArfPlots (currentObj.projectConfig);
  }

  this.onSchemaChangedWithKey = function (selectorKey, schema, params) {
    if (params !== undefined && params != null){
      currentObj.projectConfig.setFiles(selectorKey, params.filenames, params.filename);
    }

    var jsonSchema = JSON.parse(schema);
    if (isNull(jsonSchema.error)){

      if (selectorKey == "SRC"){

        currentObj.projectConfig.setSchema(jsonSchema);
        currentObj.setTitle(currentObj.projectConfig.filename);
        currentObj.projectConfig.setFile("SRC", currentObj.projectConfig.filename);
        currentObj.toolPanel.onDatasetSchemaChanged(currentObj.projectConfig);
        currentObj.enableWfSelector();
        currentObj.refreshPlotsData();

        //Reset History and add default filters
        currentObj.actionsHistory = [];
        currentObj.addToHistory("filters", currentObj.toolPanel.getFilters());

      } else {

        if (currentObj.projectConfig.hasSchema()) {
          currentObj.refreshPlotsData();
        } else {
          waitingDialog.hide();
        }

      }

    } else {
      log("onSchemaChangedWithKey error:" + schema);
      showError();
    }
  }

  this.onSchemaChangedMultipleFiles = function ( result, params ) {

    if (result != null) {
      params.filename = JSON.parse(result);
      if (params.filename == ""){
        log("onSchemaChangedMultipleFiles: server returned false!");
        waitingDialog.hide();
        return;
      }
    }

    log("onSchemaChangedMultipleFiles: " + params.currentFile + "  -  " + params.filename);

    if (params.currentFile < params.filenames.length){

      var nextfile = params.filenames[params.currentFile];
      waitingDialog.show('Appending to dataset: ' + nextfile);
      currentObj.service.append_file_to_dataset(params.filename, nextfile, currentObj.onSchemaChangedMultipleFiles, currentObj.onSchemaError, params);
      params.currentFile++;

    } else {

      waitingDialog.show('Getting file schema: ' + params.filename);
      currentObj.service.get_dataset_schema(params.filename, params.onSchemaChanged, currentObj.onSchemaError, params);
    }

  }

  this.onSchemaError = function ( error ) {
      log("onSchemaError error:" + JSON.stringify(error));
      waitingDialog.hide();
  }

  this.refreshPlotsData = function () {
    currentObj.outputPanel.onDatasetChanged(currentObj.projectConfig);
    currentObj.outputPanel.onDatasetValuesChanged();
  }

  this.onFiltersChanged = function (filters) {
    log("onFiltersChanged: filters: " + JSON.stringify(filters));
    currentObj.addToHistory("filters", filters);
    currentObj.outputPanel.onDatasetValuesChanged(filters);
  }

  this.onFiltersChangedFromPlot = function (filters) {
    log("onFiltersChangedFromPlot: filters: " + JSON.stringify(filters));
    currentObj.toolPanel.applyFilters(filters);
  }

  this.getReplaceColumn = function () {
    return currentObj.toolPanel.getReplaceColumn();
  }

  this.broadcastEventToPlots = function (evt_name, evt_data, senderId) {
    currentObj.outputPanel.broadcastEventToPlots(evt_name, evt_data, senderId);
  }

  this.addToHistory = function (actionType, actionData){
      //Adds a action to actionsHistory, uses { obj } for cloning data (new obj reference)
      if (currentObj.prevAction != null) {
        currentObj.actionsHistory.push( $.extend(true, {}, currentObj.prevAction) );
      }
      currentObj.toolPanel.undoBtn.prop('disabled', (currentObj.prevAction == null));
      //Stores a action on prevAction tmp var, uses $.extend for cloning data (new obj reference)
      currentObj.prevAction = { type: actionType,
                                actionData: $.extend(true, [], actionData),
                                binSize: this.projectConfig.binSize,
                                maxSegmentSize: this.projectConfig.maxSegmentSize };
  }

  this.undoHistory = function () {
    if (currentObj.actionsHistory.length > 0) {
      currentObj.applyAction(currentObj.actionsHistory.pop());
    }
  }

  this.resetHistory = function () {
    if (currentObj.actionsHistory.length > 0) {
      var action = currentObj.actionsHistory[0];
      currentObj.actionsHistory = []; // Clears action history keeping default state
      currentObj.applyAction(action);
      currentObj.prevAction = null;
      currentObj.addToHistory(action);
    } else {
      currentObj.applyAction(currentObj.prevAction);
    }
  }

  this.enableDragDrop = function (enabled) {
    currentObj.outputPanel.enableDragDrop(enabled);
  }

  this.applyAction = function (action){
    if (action != null){
      switch (action.type) {
           case 'filters':
               var filters = action.actionData;
               currentObj.toolPanel.setFilters(filters);
               currentObj.setBinSize(action.binSize);
               currentObj.projectConfig.maxSegmentSize = action.maxSegmentSize;
               currentObj.outputPanel.onDatasetValuesChanged(filters);
               break;

           default:
               log("undoHistory: Unknown action type: " + action.type + ", Tab.id: " + currentObj.id);
       }

       currentObj.prevAction = $.extend(true, [], action);
       currentObj.toolPanel.undoBtn.prop('disabled', currentObj.actionsHistory.length == 0);
    }
  }

  this.setBinSize = function (binSize) {
    if (!isNull(binSize) && binSize != currentObj.projectConfig.binSize) {
      currentObj.projectConfig.binSize = binSize;
      if (currentObj.toolPanel.binSelector != null){
        currentObj.toolPanel.binSelector.setValues(binSize);
      }
    }
  }

  this.enableWfSelector = function () {
    this.prepareButton(this.wfSelector.find(".filterBtn"), "filterPanel");
    this.prepareButton(this.wfSelector.find(".analyzeBtn"), "analyzePanel");
    this.prepareButton(this.wfSelector.find(".styleBtn"), "stylePanel");
    this.wfSelector.find(".wfSelectorDisableable").fadeIn();
  }

  this.destroy = function () {
    try {
      delete this.classSelector;
      delete this.navItemClass;
      delete this.service;
      this.$html.remove();
      delete this.$html;
      this.$navItem.remove();
      delete this.$navItem;

      delete this.wfSelector;
      delete this.toolPanel;
      delete this.outputPanel;
      delete this.actionsHistory;
      delete this.prevAction;
      delete this.projectConfig;

      delete this.id;
    } catch (ex) {
      log("Destroy tab " + this.id + " error: " + ex);
    }
  }

  //TAB_PANEL INITIALIZATION
  this.wfSelector = this.$html.find(".wfSelectorContainer");

  this.toolPanel = new ToolPanel (this.id + "_toolPanel",
                                  "ToolPanelTemplate",
                                  this.$html.find(".toolPanelContainer"),
                                  this.service,
                                  this.onDatasetChanged,
                                  this.onLcDatasetChanged,
                                  this.onFiltersChanged,
                                  this.undoHistory,
                                  this.resetHistory,
                                  this.enableDragDrop);

  this.outputPanel = new OutputPanel (this.id + "_outputPanel",
                                      "OutputPanelTemplate",
                                      this.$html.find(".outputPanelContainer"),
                                      this.service,
                                      this.onFiltersChangedFromPlot,
                                      this.toolPanel.getFilters );

  $(window).resize(function () { if (!isNull(currentObj.outputPanel)){currentObj.outputPanel.resize();} });

  this.prepareButton(this.wfSelector.find(".loadBtn"), "loadPanel");

  this.setCurrentPanel("loadPanel");
  this.wfSelector.find(".loadBtn").parent().addClass('active');
  this.wfSelector.find(".wfSelectorDisableable").hide();

  this.$navItem.find("." + this.navItemClass).bind("click", function( event ) {
    currentObj.show();
  });

  this.$navItem.insertBefore(".addTabPanelLi");
  this.addCloseButton();
  panelContainer.append(this.$html);
  this.show();

  log("TabPanel ready! id: " + this.id);
}


//STATIC TAB_PANEL METHODS

function getTabForSelector (selectorId) {
  for (t in tabPanels) {
    var tab = tabPanels[t];

    if (tab.toolPanel.containsId(selectorId)) {
        return tab;
    }

    if (tab.outputPanel.containsId(selectorId)) {
        return tab;
    }
  }

  return null;
}

function removeTab (id) {
  var idx = -1;

  for (t in tabPanels) {
    var tab = tabPanels[t];

    if (tab.id == id) {
        idx = t;
        break;
    }
  }

  if (idx > -1){
    tabPanels[idx].destroy();
    tabPanels.splice(idx,1);

    if (tabPanels.length > 0) {
      tabPanels[0].show()
    } else {
      $("#navbar").find(".addTabPanel").click();
    }
  }
}
