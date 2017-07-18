function addWfTabPanel(navBarList, panelContainer){
  tab = new WfTabPanel("Tab_" + tabPanels.length, "TabPanelTemplate", "NavItem_" + tabPanels.length, theService, navBarList, panelContainer);
  tabPanels.push(tab);
}

//WorkFlow tab panel
function WfTabPanel (id, classSelector, navItemClass, service, navBarList, panelContainer) {

  var currentObj = this;

  TabPanel.call(this, id, classSelector, navItemClass, navBarList, panelContainer);

  //WORKFLOW TAB_PANEL ATTRIBUTES
  this.service = service;

  this.actionsHistory = [];
  this.prevAction = null;

  this.projectConfig = new ProjectConfig();

  //TAB_PANEL METHODS AND EVENTS HANDLERS
  this.containsId = function (id) {
    if (this.id == id) {
        return true;
    } else if (this.toolPanel.containsId(id)) {
        return true;
    } else if (this.outputPanel.containsId(id)) {
        return true;
    }

    return false;
  }

  this.prepareButton = function ( buttonElem, panel ) {
    buttonElem.button().click(function () {
      currentObj.wfSelector.find("li").removeClass('active');
      $(this).parent().addClass("active");
      currentObj.setCurrentPanel(panel);
    });
  }

  this.setCurrentPanel = function ( panel ) {
    this.toolPanel.showPanel(panel);
  }

  this.onDatasetChanged = function ( filenames, selectorKey ) {

    if (selectorKey == "SRC") {
      //If SRC file was load just create a new project config
      currentObj.projectConfig = new ProjectConfig();
    }

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

    if (selectorKey == "SRC") {
      //If SRC file was load just create a new project config
      currentObj.projectConfig = new ProjectConfig();
    }

    if (filenames.length == 1) {

      log("onLcDatasetChanged " + selectorKey + ": " + filenames[0]);
      currentObj.projectConfig.setFile(selectorKey, filenames[0]);
      if (currentObj.projectConfig.hasSchema()) {

        //Cleans previous plots for this selectorKey
        currentObj.outputPanel.removePlotsById(currentObj.projectConfig.getPlotsIdsByKey(selectorKey));
        currentObj.projectConfig.cleanPlotsIdsKey(selectorKey);
        if (((selectorKey == "LCB") || (selectorKey == "LCA"))) {
          currentObj.projectConfig.setFile("LC_B/A", "");
        } if (((selectorKey == "LCD") || (selectorKey == "LCC"))) {
          currentObj.projectConfig.setFile("LC_D/C", "");
        }

        //Add the new plots for this selectorKey
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

      currentObj.service.get_dataset_schema(currentObj.projectConfig.filename, function( jsonSchema, params ){

        log("onRmfApplied: Success!");
        var schema = JSON.parse(jsonSchema);
        currentObj.projectConfig.updateSchema(schema);
        currentObj.toolPanel.onRmfDatasetUploaded(currentObj.projectConfig.schema);

        //Cleans previous plots for RMF key
        currentObj.outputPanel.removePlotsById(currentObj.projectConfig.getPlotsIdsByKey("RMF"));
        currentObj.projectConfig.cleanPlotsIdsKey("RMF");

        //Add RMF plots
        currentObj.outputPanel.addRmfPlots(currentObj.projectConfig);

        //Enable Spectral Timing Section
        if (!currentObj.toolPanel.isSectionEnabled("TimingPlot")){
          currentObj.toolPanel.toggleEnabledSection("TimingPlot");
        } else {
          currentObj.outputPanel.setToolbarSectionVisible("TimingPlot", true);
        }

        //Hides upload RMF buttons from Analyze tab
        currentObj.toolPanel.$html.find(".rmsBtn").remove();
        currentObj.toolPanel.$html.find(".covarianceBtn").remove();
        currentObj.toolPanel.$html.find(".phaseLagBtn").remove();

        waitingDialog.hide();

      }, currentObj.onSchemaError, null);
    } else {
      log("onRmfApplied error:" + JSON.stringify(result));
      waitingDialog.hide();
    }
  }

  this.onArfUploaded = function () {
    log("onArfUploaded:");
    //currentObj.outputPanel.addArfPlots (currentObj.projectConfig);
    waitingDialog.hide();
  }

  this.onSchemaChangedWithKey = function (selectorKey, schema, params) {
    if (params !== undefined && params != null){
      currentObj.projectConfig.setFiles(selectorKey, params.filenames, params.filename);
    }

    var jsonSchema = JSON.parse(schema);
    if (isNull(jsonSchema.error)){

      if (selectorKey == "SRC"){

        //Update projectConfig schema and tabPanel info
        currentObj.projectConfig.setSchema(jsonSchema);
        currentObj.setTitle(currentObj.projectConfig.filename);
        currentObj.projectConfig.setFile("SRC", currentObj.projectConfig.filename);

        //Prepare sections
        var timingPlotsButtons = [];
        timingPlotsButtons = currentObj.addButtonToArray("Cross Spectrum",
                                                          "crossSpectraBtn",
                                                          currentObj.showCrossSpectraSelection,
                                                          timingPlotsButtons);

        timingPlotsButtons = currentObj.addButtonToArray("Frequency lag",
                                                          "freqLagBtn",
                                                          currentObj.showCrossSpectraSelection,
                                                          timingPlotsButtons);

        timingPlotsButtons = currentObj.addButtonToArray("Coherence",
                                                          "coherenceBtn",
                                                          currentObj.showCrossSpectraSelection,
                                                          timingPlotsButtons);

        timingPlotsButtons = currentObj.addButtonToArray("Covariance spectrum",
                                                          "covarianceBtn",
                                                          currentObj.showUploadRMFDialog,
                                                          timingPlotsButtons);

        timingPlotsButtons = currentObj.addButtonToArray("RMS spectrum",
                                                          "rmsBtn",
                                                          currentObj.showUploadRMFDialog,
                                                          timingPlotsButtons);

        timingPlotsButtons = currentObj.addButtonToArray("Phase lag spectrum",
                                                          "phaseLagBtn",
                                                          currentObj.showUploadRMFDialog,
                                                          timingPlotsButtons);

        var sections = [
            { cssClass: "LcPlot", title:"Light Curves and Colors" },
            { cssClass: "PDSPlot", title:"Power Density Spectra" },
            { cssClass: "TimingPlot", title:"Spectral Timing", extraButtons: timingPlotsButtons }
        ];

        currentObj.toolPanel.setAnalisysSections(sections);
        currentObj.outputPanel.setAnalisysSections(sections);

        //Prepare toolPanel filters, workflow config and load outputPanel plots
        currentObj.toolPanel.onDatasetSchemaChanged(currentObj.projectConfig);
        currentObj.enableWfSelector();
        currentObj.refreshPlotsData();

        //Set enabled section by default
        if (sections.length > 0) {
          this.toolPanel.toggleEnabledSection(sections[0].cssClass);
        }

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

  this.addButtonToArray = function (buttonText, buttonClass, buttonFn, array) {
    var btn = $('<button class="btn btn-default btnShow ' + this.id + ' ' + buttonClass + ' ExtraButton">' +
                  '<i class="fa fa-area-chart" aria-hidden="true"></i> ' + buttonText +
                '</button>');
    btn.click(buttonFn);
    array.push(btn);
    return array;
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

  this.onTimeRangeChanged = function (timeRange) {
    log("onTimeRangeChanged: timeRange: " + timeRange);
    this.updateTimeRange(timeRange);
    this.toolPanel.onTimeRangeChanged(timeRange);
  }

  this.updateTimeRange = function (timeRange) {
    this.projectConfig.maxSegmentSize = timeRange * 0.95; //Math.min (timeRange * 0.95, currentObj.projectConfig.maxSegmentSize);
    this.projectConfig.avgSegmentSize = this.projectConfig.maxSegmentSize / CONFIG.DEFAULT_SEGMENT_DIVIDER;
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

  this.showCrossSpectraSelection = function () {
    var switchablePlots = currentObj.outputPanel.plots.filter(function(plot) { return plot.isSelectable() && plot.isVisible; });
    if (switchablePlots.length > 1) {

      //Else show dialog for choose the desired plots
      var lcPlotButtons = "";
      for (i in switchablePlots) {
         var plot = switchablePlots[i];
         lcPlotButtons += '<button class="btn btn-default btnSelect ' + plot.id + (plot.$html.hasClass("plotSelected")?" plotSelected":"") + '" plotId="' + plot.id + '">' +
                             '<i class="fa fa-thumb-tack" aria-hidden="true"></i> ' + plot.plotConfig.styles.title +
                           '</button>';
       };

      var $xSpectraDialog = $('<div id="xSpectraDialog_' + currentObj.id +  '" title="Select two light curves:">' +
                                  '<div class="xsDialogContainer">' +
                                    lcPlotButtons +
                                  '</div>' +
                              '</div>');

      $xSpectraDialog.find("button").click(function(event){
         var btn = $(this);
         btn.toggleClass("plotSelected");
         var plotId = btn.attr("plotId");
         var plot = currentObj.outputPanel.getPlotById(plotId);
         plot.btnSelect.click();
         if ($(this).parent().find(".plotSelected").length > 1) {
              $xSpectraDialog.dialog('close');
              $xSpectraDialog.remove();
         }
      });

      currentObj.$html.append($xSpectraDialog);
      $xSpectraDialog.dialog({
         width: 450,
         modal: true,
         buttons: {
           'Cancel': function() {
              $(this).dialog('close');
              $xSpectraDialog.remove();
           }
         }
       });
       $xSpectraDialog.parent().find(".ui-dialog-titlebar-close").html('<i class="fa fa-times" aria-hidden="true"></i>');

    } else {
      var lcPlots = currentObj.outputPanel.plots.filter(function(plot) { return plot.isSelectable() });
      showMsg("Spectral Timing:", "At least two plots of type Light Curve must be visible/enabled to continue. " +
                                  "</br> Use <i class='fa fa-eye' aria-hidden='true'></i> buttons to enable plots" +
                                  ((lcPlots.length > 4) ? "." : " or use the Load section to upload more Light Curve's files." +
                                  "</br> Also you can use the <i class='fa fa-thumb-tack' aria-hidden='true'></i> button to select two Ligth Curve's plots" +
                                  " of the same Tab or from different Tabs to create a Cross Spectrum Tab."));
    }
  }

  this.showUploadRMFDialog = function () {
    //Show upload RMF file
    var $uploadRMFDialog = $('<div id="uploadRMFDialog_' + currentObj.id +  '" title="Upload RMF file:">' +
                                '<div class="rmfDialogContainer">' +
                                  '<p class="text-warning">RMF file is requiered for "Covariance spectrum", "RMS spectrum" and "Phase lag spectrum"</p>' +
                                '</div>' +
                            '</div>');

    currentObj.$html.append($uploadRMFDialog);
    $uploadRMFDialog.dialog({
       width: 450,
       modal: true,
       buttons: {
         'Upload RMF file': function() {
            currentObj.toolPanel.rmfFileSelector.showSelectFile();
            $(this).dialog('close');
            $uploadRMFDialog.remove();
         },
         'Cancel': function() {
            $(this).dialog('close');
            $uploadRMFDialog.remove();
         }
       }
     });
     $uploadRMFDialog.parent().find(".ui-dialog-titlebar-close").html('<i class="fa fa-times" aria-hidden="true"></i>');
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

  log("WfTabPanel ready! id: " + this.id);
}
