function addWfTabPanel(navBarList, panelContainer, id, navItemClass){
  tab = new WfTabPanel(!isNull(id) ? id : "Tab_" + tabPanels.length,
                       "TabPanelTemplate",
                       !isNull(navItemClass) ? navItemClass : "NavItem_" + tabPanels.length,
                       theService,
                       navBarList,
                       panelContainer);
  tabPanels.push(tab);
  return tab;
}

//Subscribes the load workspace WfTabPanel function
tabPanelsLoadFns["WfTabPanel"] = function (tabConfig) {
  //Creates new Workflow Tab Panel
  return addWfTabPanel($("#navbar").find("ul").first(),
                      $(".daveContainer"),
                      tabConfig.id,
                      tabConfig.navItemClass);
}

//WorkFlow tab panel
function WfTabPanel (id, classSelector, navItemClass, service, navBarList, panelContainer) {

  var currentObj = this;

  TabPanel.call(this, id, classSelector, navItemClass, navBarList, panelContainer);

  //WORKFLOW TAB_PANEL ATTRIBUTES
  this.service = service;
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

  this.onDatasetChanged = function ( filenames, selectorKey, callback) {

    if ((selectorKey == "SRC") && (filenames.length > 0)) {
      //If SRC file was load just create a new project config
      currentObj.projectConfig = new ProjectConfig();
    }

    if (filenames.length == 1) {

      currentObj.projectConfig.setFiles(selectorKey, [], filenames[0]);
      waitingDialog.show('Getting file schema: ' + getFilename(filenames[0]));
      log("onDatasetChanged " + selectorKey + ": " + filenames[0]);
      if (selectorKey == "SRC") {
        currentObj.service.get_dataset_schema(currentObj.projectConfig.filename, currentObj.onSrcSchemaChanged, currentObj.onSchemaError, !isNull(callback) ? { callback: callback } : null );
      } else if (selectorKey == "BCK") {
        currentObj.service.get_dataset_schema(currentObj.projectConfig.bckFilename, currentObj.onBckSchemaChanged, currentObj.onSchemaError, !isNull(callback) ? { callback: callback } : null );
      } else if (selectorKey == "GTI") {
        currentObj.service.get_dataset_schema(currentObj.projectConfig.gtiFilename, currentObj.onGtiSchemaChanged, currentObj.onSchemaError, !isNull(callback) ? { callback: callback } : null );
      } else if ((selectorKey == "RMF") && currentObj.projectConfig.hasSchema()) {
        waitingDialog.show('Applying RMF: ' + getFilename(filenames[0]));
        currentObj.service.apply_rmf_file_to_dataset(currentObj.projectConfig.filename, currentObj.projectConfig.rmfFilename, function (res) { currentObj.onRmfApplied(res, callback); } );
      }

    } else if (filenames.length > 1){

      if (currentObj.toolPanel.loadFileType == "Independent") {

        //Load an independent tab for each file
        for (idx in filenames){
            var file = filenames[idx];
            openIndependentFileTab(file);
        }
        //Removes this tab
        removeTab(currentObj.id);

      } else {

        //Concatenate all files
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
        }

        if (!isNull(callback)){
          params.callback = callback;
        }

        currentObj.onSchemaChangedMultipleFiles(null, params);
      }

    } else {
      log("onDatasetChanged " + selectorKey + ": No selected files..");

      if (currentObj.projectConfig.getFile(selectorKey) != ""){
        //If previous file was setted

        if (selectorKey == "SRC") {
          //Reset this tab
          removeTab(currentObj.id);
        } else {
          //Update projectConfig files
          currentObj.projectConfig.setFiles(selectorKey, [], "");
          currentObj.projectConfig.updateFile(selectorKey);
          currentObj.outputPanel.updatePlotsFiles (currentObj.projectConfig);
        }
      }

      if (!isNull(callback)) { callback(); }
    }

  }

  this.onLcDatasetChanged = function ( filenames, selectorKey, callback ) {

    if (!currentObj.projectConfig.hasSchema()) {
      log("onLcDatasetChanged " + selectorKey + " , SRC schema not loaded yet!");
      showError("Upload a Source File first!");
      return;
    }

    if (filenames.length == 1) {

      log("onLcDatasetChanged " + selectorKey + ": " + filenames[0]);

      //If file were upladed, then check if is valid schema
      currentObj.service.get_dataset_header(filenames[0], function( jsonHeader ){

        if (!isNull(jsonHeader.abort)){
          //Comes from error returned request.
          showError("Wrong lightcurve file!");
          return;
        }

        var header = JSON.parse(jsonHeader);
        if (!isNull(header)) {

          log("onLcDatasetChanged - get_dataset_header: " + selectorKey + ": " + filenames[0]);
          currentObj.onLcHeaderReceived(selectorKey, filenames[0], header);

        } else {
          showError("Wrong lightcurve file!");
        }

        if (!isNull(callback)) { callback(); }
      });

    } else if (filenames.length > 1){
      showError("Multifile selection not supported with lightcurves!");
      log("onLcDatasetChanged " + selectorKey + ": Multifile selection not supported yet..");
      waitingDialog.hide();
      if (!isNull(callback)) { callback(); }
    } else {
      log("onLcDatasetChanged " + selectorKey + ": No selected files..");

      if (currentObj.projectConfig.getFile(selectorKey) != ""){
        //If previous file was setted
        currentObj.onLcHeaderReceived(selectorKey, "", null);
      }

      waitingDialog.hide();
      if (!isNull(callback)) { callback(); }
    }

  }

  this.onLcHeaderReceived = function (selectorKey, filename, header) {

    currentObj.projectConfig.setFile(selectorKey, filename);

    var isBckFile = selectorKey.endsWith("_BCK");
    if (isBckFile) {
      selectorKey = selectorKey.replace("_BCK", "");
    }

    //Cleans previous plots for this selectorKey
    currentObj.outputPanel.removePlotsById(currentObj.projectConfig.getPlotsIdsByKey(selectorKey));
    currentObj.projectConfig.cleanPlotsIdsKey(selectorKey);
    if (((selectorKey == "LCB") || (selectorKey == "LCA"))) {
      currentObj.projectConfig.setFile("LC_B/A", "");
    } if (((selectorKey == "LCD") || (selectorKey == "LCC"))) {
      currentObj.projectConfig.setFile("LC_D/C", "");
    }

    //Tries to get filter info from file header info, and updates bck selector
    if (!isBckFile){
      if (filename != ""){
        currentObj.toolPanel.setInfoTextToFileSelector(selectorKey, extractEnergyRangeTextFromHeader(header));
        currentObj.toolPanel.getFileSelector(selectorKey + "_BCK").show();
        currentObj.toolPanel.setInfoTextToFileSelector(selectorKey + "_BCK", (getBackgroundSubstracted(header["RATE"]) ? "Background already substracted" : ""), CONFIG.DENY_BCK_IF_SUBS);
      } else {
        currentObj.toolPanel.setInfoTextToFileSelector(selectorKey, "");
        currentObj.toolPanel.getFileSelector(selectorKey + "_BCK").hide();
        currentObj.toolPanel.setInfoTextToFileSelector(selectorKey + "_BCK", "");
      }
    }

    //Add the new plots for this selectorKey
    if (currentObj.projectConfig.getFile(selectorKey) != ""){
      currentObj.outputPanel.addLightcurveAndPdsPlots(selectorKey,
                                                      currentObj.projectConfig.getFile(selectorKey),
                                                      currentObj.projectConfig.getFile(selectorKey + "_BCK"),
                                                      "", "RATE", "RATE", currentObj.projectConfig, "", true);
      currentObj.outputPanel.tryAddDividedLightCurve("LCB", "LCA", "B/A", currentObj.projectConfig);
      currentObj.outputPanel.tryAddDividedLightCurve("LCD", "LCC", "D/C", currentObj.projectConfig);
    }

    waitingDialog.hide();
  }

  this.onSrcSchemaChanged = function ( schema, params ) {
    log("onSrcSchemaChanged:" + schema);
    if (!isNull(schema)){
      currentObj.onSchemaChangedWithKey("SRC", schema, params);
    } else {
      showError("Wrong Source file!");
      if (!isNull(params) && !isNull(params.callback)) { params.callback(); }
    }
  }

  this.onBckSchemaChanged = function ( schema, params ) {
    log("onBckDatasetChanged:" + schema);
    if (!isNull(schema)){
      currentObj.onSchemaChangedWithKey("BCK", schema, params);
    } else {
      showError("Wrong Background file!");
      if (!isNull(params) && !isNull(params.callback)) { params.callback(); }
    }
  }

  this.onGtiSchemaChanged = function ( schema, params ) {
    log("onGtiSchemaChanged:" + schema);
    if (!isNull(schema)){
      currentObj.onSchemaChangedWithKey("GTI", schema, params);
    } else {
      showError("Wrong GTI file!");
      if (!isNull(params) && !isNull(params.callback)) { params.callback(); }
    }
  }

  this.onRmfApplied = function ( result, callback ) {
    result = JSON.parse(result);
    if (!isNull(result) && result.length > 0){
      log("onRmfApplied: Getting new shema..");

      currentObj.projectConfig.setRmfData(result);

      currentObj.service.get_dataset_schema(currentObj.projectConfig.filename, function( jsonSchema, params ){

        log("onRmfApplied: Success!");
        var schema = JSON.parse(jsonSchema);
        currentObj.projectConfig.updateFile("RMF");
        currentObj.projectConfig.updateSchema(schema);
        currentObj.toolPanel.onRmfDatasetUploaded(currentObj.projectConfig.schema);

        //Cleans previous plots for RMF key
        currentObj.outputPanel.removePlotsById(currentObj.projectConfig.getPlotsIdsByKey("RMF"));
        currentObj.projectConfig.cleanPlotsIdsKey("RMF");

        //Add RMF plots
        currentObj.outputPanel.addRmfPlots(currentObj.projectConfig);

        //Hides upload RMF buttons from Analyze tab
        currentObj.toolPanel.$html.find(".rmsBtn").remove();
        currentObj.toolPanel.$html.find(".covarianceBtn").remove();
        currentObj.toolPanel.$html.find(".phaseLagBtn").remove();

        waitingDialog.hide();
        if (!isNull(callback)) { callback(); }

      }, currentObj.onSchemaError, null);
    } else {
      log("onRmfApplied error:" + JSON.stringify(result));
      showError("Wrong RMF file!");
      if (!isNull(callback)) { callback(); }
    }
  }

  this.onSchemaChangedWithKey = function (selectorKey, schema, params) {
    if (!isNull(params) && !isNull(params.filename)){
      currentObj.projectConfig.setFiles(selectorKey, params.filenames, params.filename);
    }

    var jsonSchema = JSON.parse(schema);
    if (!isNull(jsonSchema) && isNull(jsonSchema.error)){

      currentObj.projectConfig.updateFile(selectorKey);

      if (selectorKey == "SRC"){

        //Update projectConfig schema and tabPanel info
        currentObj.projectConfig.setSchema(jsonSchema);
        currentObj.setTitle(getFilename(currentObj.projectConfig.filename));

        //Prepare sections
        var sections = currentObj.getAnalysisSections();
        currentObj.toolPanel.setAnalisysSections(sections);
        if (CONFIG.BULK_ANALYSIS_ENABLED) {
          currentObj.toolPanel.addBulkAnalisysButton();
        }

        //Prepare toolPanel filters, workflow config and load outputPanel plots
        currentObj.toolPanel.onDatasetSchemaChanged(currentObj.projectConfig);
        currentObj.enableWfSelector();
        currentObj.outputPanel.onDatasetChanged(currentObj.projectConfig);

        //Set enabled section by default
        if (sections.length > 0) {
          this.toolPanel.toggleEnabledSection(sections[0].cssClass);
        }

        //Reset History and add default filters
        currentObj.historyManager.actionsHistory = [];
        currentObj.addToHistory("filters", currentObj.toolPanel.getFilters());

      } else {

        if (currentObj.projectConfig.hasSchema()) {
          //We can update the filepaths of every plot
          currentObj.outputPanel.updatePlotsFiles (currentObj.projectConfig);
        }

        waitingDialog.hide();
      }

    } else {
      log("onSchemaChangedWithKey error:" + schema);
      showError();
    }

    if (!isNull(params) && !isNull(params.callback)) { params.callback(); }
  }

  this.getAnalysisSections = function (){
    //Returns the analisys tab sections and their buttons

    var timingPlotsButtons = [];
    timingPlotsButtons = currentObj.addButtonToArray("Cross Spectrum",
                                                      "crossSpectraBtn",
                                                      currentObj.showCrossSpectraSelection,
                                                      timingPlotsButtons);

    timingPlotsButtons = currentObj.addButtonToArray("Frequency Lag",
                                                      "freqLagBtn",
                                                      currentObj.showCrossSpectraSelection,
                                                      timingPlotsButtons);

    timingPlotsButtons = currentObj.addButtonToArray("Coherence",
                                                      "coherenceBtn",
                                                      currentObj.showCrossSpectraSelection,
                                                      timingPlotsButtons);

    if (currentObj.projectConfig.schema.isEventsFile()) {
      //Adds RMF file depending plots
      timingPlotsButtons = currentObj.addButtonToArray("Covariance spectrum",
                                                        "covarianceBtn",
                                                        function () { currentObj.showUploadRMFDialog("covariance") },
                                                        timingPlotsButtons);

      timingPlotsButtons = currentObj.addButtonToArray("RMS spectrum",
                                                        "rmsBtn",
                                                        function () { currentObj.showUploadRMFDialog("rms") },
                                                        timingPlotsButtons);

      timingPlotsButtons = currentObj.addButtonToArray("Phase Lag spectrum",
                                                        "phaseLagBtn",
                                                        function () { currentObj.showUploadRMFDialog("phaseLag") },
                                                        timingPlotsButtons);
    }

    var variancePlotsButtons = [];
    variancePlotsButtons = currentObj.addButtonToArray("Mean flux estimator",
                                                  "baselineBtn",
                                                  function () {
                                                    currentObj.showLcSelectionDialog("Mean flux estimator (baseline):",
                                                                                     onBaselinePlotSelected);
                                                  },
                                                  variancePlotsButtons);

    variancePlotsButtons = currentObj.addButtonToArray("Intrinsic variance estimator",
                                                  "intVarBtn",
                                                  function () {
                                                    currentObj.showLcSelectionDialog("Longterm variability of AGN:",
                                                                                     onAGNPlotSelected);
                                                  },
                                                  variancePlotsButtons);

    variancePlotsButtons = currentObj.addButtonToArray("Periodic signals search",
                                                  "periodogramBtn",
                                                  function () {
                                                    currentObj.showLcSelectionDialog("Periodic signals search:",
                                                                                     onPeriodogramPlotSelected);
                                                  },
                                                  variancePlotsButtons);

    var pulsarPlotsButtons = [];
    pulsarPlotsButtons = currentObj.addButtonToArray("Phaseogram",
                                                  "phaseogramBtn",
                                                  function () {
                                                    currentObj.showLcSelectionDialog("Phaseogram:",
                                                                                     onPhaseogramPlotSelected);
                                                  },
                                                  pulsarPlotsButtons);

    return [
              { cssClass: "LcPlot", title:"Light Curves and Colors" },
              { cssClass: "PDSPlot", title:"Power Density Spectra" },
              { cssClass: "TimingPlot", title:"Spectral Timing", extraButtons: timingPlotsButtons },
              { cssClass: "VariancePlot", title:"Longterm Variability Analysis", extraButtons: variancePlotsButtons },
              { cssClass: "PulsarPlot", title:"X-Ray Pulsars", extraButtons: pulsarPlotsButtons }
          ];
  }

  this.addButtonToArray = function (buttonText, buttonClass, buttonFn, array) {
    var btn = $('<button class="btn btn-default btnShow ' + this.id + ' ' + buttonClass + ' ExtraButton">' +
                  '<i class="fa fa-area-chart" aria-hidden="true"></i> ' + buttonText +
                '</button>');
    btn.click(buttonFn);
    array.push(btn);
    return array;
  }

  this.setSectionVisibility = function (section, visible) {
    if (this.toolPanel.isSectionEnabled(section) != visible){
      this.toolPanel.setEnabledSection(section, visible);
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
      waitingDialog.show('Appending to dataset: ' + getFilename(nextfile));
      currentObj.service.append_file_to_dataset(params.filename, nextfile, currentObj.onSchemaChangedMultipleFiles, currentObj.onSchemaError, params);
      params.currentFile++;

    } else {

      waitingDialog.show('Getting file schema: ' + getFilename(params.filename));
      currentObj.service.get_dataset_schema(params.filename, params.onSchemaChanged, currentObj.onSchemaError, params);
    }

  }

  this.onSchemaError = function ( error ) {
      log("onSchemaError error:" + JSON.stringify(error));
      waitingDialog.hide();
      showError();
  }

  this.updateMinMaxCountRate = function (minRate, maxRate) {
    if (this.projectConfig.hasSchema()
        && this.projectConfig.schema.isEventsFile()) {

      minRate = Math.floor (minRate);
      maxRate = Math.ceil (maxRate);

      if (!currentObj.toolPanel.isCountRateSliderCreated()) {
        //Creates the rate slider if not created yet:
        currentObj.toolPanel.createCountRateSlider(minRate, maxRate);
      } else {
        //Udpated rate slider min and max values
        currentObj.toolPanel.updateCountRateSlider(minRate, maxRate);
      }

    }
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
      //Prepares undo button
      currentObj.toolPanel.undoBtn.prop('disabled', (currentObj.historyManager.prevAction == null));

      //Adds a action to historyManager
      var action = { type: actionType,
               actionData: $.extend(true, [], actionData),
               binSize: this.projectConfig.binSize,
               maxSegmentSize: this.projectConfig.maxSegmentSize };
      currentObj.historyManager.addToHistory(action);
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
               log("applyAction: Unknown action type: " + action.type + ", Tab.id: " + currentObj.id);
       }

       currentObj.toolPanel.undoBtn.prop('disabled', currentObj.historyManager.actionsHistory.length == 0);
    }
  }

  this.enableDragDrop = function (enabled) {
    currentObj.outputPanel.enableDragDrop(enabled);
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
    var lcPlotButtons = currentObj.getLcButtonsHtml();
    if (lcPlotButtons.Count > 1) {

      //Else show dialog for choose the desired plots
      var $xSpectraDialog = $('<div id="xSpectraDialog_' + currentObj.id +  '" title="Select two light curves:">' +
                                  '<div class="dialogContainer xsDialogContainer">' +
                                    lcPlotButtons.Html +
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
      currentObj.createCustomDialog($xSpectraDialog);

    } else {
      var lcPlots = currentObj.outputPanel.plots.filter(function(plot) { return plot.isSelectable() });
      showMsg("Spectral Timing:", "At least two plots of type Light Curve must be visible/enabled to continue. " +
                                  "</br> Use <i class='fa fa-eye' aria-hidden='true'></i> buttons to enable plots" +
                                  ((lcPlots.length > 4) ? "." : " or use the Load section to upload more Light Curve's files." +
                                  "</br> Also you can use the <i class='fa fa-thumb-tack' aria-hidden='true'></i> button to select two Ligth Curve's plots" +
                                  " of the same Tab or from different Tabs to create a Cross Spectrum Tab."));
    }
  }

  this.showUploadRMFDialog = function (plotType) {
    //Show upload RMF file
    var $uploadRMFDialog = $('<div id="uploadRMFDialog_' + currentObj.id +  '" title="Upload RMF file:">' +
                                '<div class="rmfDialogContainer">' +
                                  '<p class="text-warning">RMF file is requiered for "Covariance spectrum", "RMS spectrum" and "Phase lag spectrum"</p>' +
                                '</div>' +
                            '</div>');

    currentObj.outputPanel.waitingPlotType = plotType;
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

  this.showLcSelectionDialog = function (title, onPlotSelectedFn) {
    var lcPlotButtons = currentObj.getLcButtonsHtml(false);
    if (lcPlotButtons.Count > 0) {

      //Else show dialog for choose the desired plots
      var $lcDialog = $('<div id="lcDialog_' + currentObj.id +  '" title="Select a light curve:">' +
                            '<div class="dialogContainer lcDialogContainer">' +
                              lcPlotButtons.Html +
                            '</div>' +
                        '</div>');

      $lcDialog.find("button").click(function(event){
         var plotId = $(this).attr("plotId");
         var plot = currentObj.outputPanel.getPlotById(plotId);
         onPlotSelectedFn(plot);
         $lcDialog.dialog('close');
         $lcDialog.remove();
      });

      currentObj.$html.append($lcDialog);
      currentObj.createCustomDialog($lcDialog);

    } else {
      showMsg(title, "At least one plot of type Light Curve must be visible/enabled to continue. " +
                     "</br> Use <i class='fa fa-eye' aria-hidden='true'></i> buttons to enable plots.");
    }
  }

  this.getLcButtonsHtml = function (showAsSelected) {
    var lcPlotButtons = "";
    var selectablePlots = currentObj.outputPanel.plots.filter(function(plot) { return plot.isSelectable() && plot.isVisible; });
    for (i in selectablePlots) {
       var plot = selectablePlots[i];
       lcPlotButtons += '<button class="btn btn-default btnSelect ' + plot.id + ((plot.$html.hasClass("plotSelected") && (isNull(showAsSelected) || showAsSelected))?" plotSelected":"") + '" plotId="' + plot.id + '">' +
                           '<i class="fa fa-thumb-tack" aria-hidden="true"></i> ' + plot.plotConfig.styles.title +
                         '</button>';
     };
     return { Html: lcPlotButtons, Count: selectablePlots.length };
  }

  this.createCustomDialog = function ($dialogElement) {
    $dialogElement.dialog({
       width: 450,
       modal: true,
       buttons: {
         'Cancel': function() {
            $(this).dialog('close');
            $dialogElement.remove();
         }
       }
     });
     $dialogElement.parent().find(".ui-dialog-titlebar-close").html('<i class="fa fa-times" aria-hidden="true"></i>');
  }

  this.getConfig = function () {
    return { type: "WfTabPanel",
             id: this.id,
             navItemClass: this.navItemClass,
             projectConfig: this.projectConfig.getConfig(),
             toolPanelConfig: this.toolPanel.getConfig(this.projectConfig),
             outputPanelConfig: this.outputPanel.getConfig()
           };
  }

  this.setConfig = function (tabConfig, callback) {
    log("setConfig for tab " + this.id);

    async.waterfall([
        function(callback) {
            currentObj.toolPanel.setConfig(tabConfig.projectConfig, callback);
        },
        function(callback) {
            currentObj.outputPanel.setConfig(tabConfig.outputPanelConfig);
            callback();
        },
        function(callback) {
            currentObj.historyManager.applyAction(tabConfig.toolPanelConfig);
            callback();
        }
    ], function (err, result) {
        if (!isNull(err)){
          log("setConfig on tab " + currentObj.id + " error: " + err);
        } else {
          log("setConfig success for tab " + currentObj.id);
        }
        callback(err);
    });
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
      delete this.historyManager;
      delete this.projectConfig;

      delete this.id;
    } catch (ex) {
      log("Destroy tab " + this.id + " error: " + ex);
    }
  }

  //TAB_PANEL INITIALIZATION
  this.historyManager = new HistoryManager(this.applyAction);

  this.wfSelector = this.$html.find(".wfSelectorContainer");

  this.toolPanel = new ToolPanel (this.id + "_toolPanel",
                                  "ToolPanelTemplate",
                                  this.$html.find(".toolPanelContainer"),
                                  this.service,
                                  this.onDatasetChanged,
                                  this.onLcDatasetChanged,
                                  this.onFiltersChanged,
                                  this.historyManager,
                                  this.enableDragDrop);

  this.outputPanel = new WfOutputPanel (this.id + "_wfOutputPanel",
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

  return this;
}

function openIndependentFileTab (filename) {
    var tab = addWfTabPanel($("#navbar").find("ul").first(), $(".daveContainer"));
    tab.toolPanel.srcFileSelector.onUploadSuccess([filename]);
    tab.onDatasetChanged([filename], "SRC");
}
