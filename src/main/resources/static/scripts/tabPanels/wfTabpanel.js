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

  //Adds random number to Id
  id = id + "_" + (new Date()).getTime();

  TabPanel.call(this, id, classSelector, navItemClass, navBarList, panelContainer);

  //WORKFLOW TAB_PANEL ATTRIBUTES
  this.service = service;
  this.projectConfig = new ProjectConfig();

  //TAB_PANEL METHODS AND EVENTS HANDLERS
  this.containsId = function (id) {
    return (this.id == id)
            || (this.toolPanel.containsId(id))
            || (this.outputPanel.containsId(id));
  }

  this.prepareTabButton = function ( buttonElem ) {
    buttonElem.button().click(function () {
      currentObj.setCurrentPanel($(this).attr("panel"));
    });
  }

  this.setCurrentPanel = function ( panel ) {
    this.wfSelector.find("li").removeClass('active');
    this.wfSelector.find("[panel='" + panel + "']").parent().addClass("active");
    this.toolPanel.showPanel(panel);
  }

  this.getCurrentPanel = function ( panel ) {
    return this.wfSelector.find("li.active").find("a").attr("panel");
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

    } else {
      log("onDatasetChanged " + selectorKey + ": No selected files..");

      if ((currentObj.projectConfig.getFile(selectorKey) != "")
          && (selectorKey != "SRC")){
        //If previous file was setted and is not the SRC file then update projectConfig files
        currentObj.projectConfig.setFiles(selectorKey, [], "");
        currentObj.projectConfig.updateFile(selectorKey);
        currentObj.outputPanel.updatePlotsFiles (currentObj.projectConfig);
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

    //Add infopanel for this file
    currentObj.addInfoPanel(currentObj.projectConfig.getFile(selectorKey));

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

        //Adds infoPanel for this file
        currentObj.addInfoPanel(currentObj.projectConfig.getFile("RMF"));

        waitingDialog.hide();
        if (!isNull(callback)) { callback(); }

      }, currentObj.onSchemaError, null);
    } else {
      logErr("onRmfApplied error:" + JSON.stringify(result));
      showError("Wrong RMF file!");
      if (!isNull(callback)) { callback(); }
    }
  }

  this.onSchemaChangedWithKey = function (selectorKey, jsonSchema, params) {
    if (!isNull(params) && !isNull(params.filename)){
      currentObj.projectConfig.setFiles(selectorKey, params.filenames, params.filename);
    }

    var schema = JSON.parse(jsonSchema);
    if (!isNull(schema) && isNull(schema.error)){

      currentObj.projectConfig.updateFile(selectorKey);

      if (selectorKey == "SRC"){

        //Update projectConfig schema and tabPanel info
        currentObj.projectConfig.setSchema(schema);
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

      //Adds infoPanel for this file
      if (!isNull(params) && !isNull(params.filename)){
        for (i in params.filenames){
          currentObj.addInfoPanel(params.filenames[i]);
        }
      } else {
        currentObj.addInfoPanel(currentObj.projectConfig.getFile(selectorKey), schema);
      }

    } else {
      logErr("onSchemaChangedWithKey error:" + schema);
      showError();
    }

    if (!isNull(params) && !isNull(params.callback)) { params.callback(); }
  }

  this.addInfoPanel = function ( filepath, schema ) {
    if (filepath != ""){
      if (isNull(schema)) {
        log("addInfoPanel.get_dataset_schema: filepath: " + filepath);
        currentObj.service.get_dataset_schema(filepath, function( jsonSchema ){

          //Calls this function again with the schema obj
          log("addInfoPanel.get_dataset_schema: Success!");
          currentObj.addInfoPanel(filepath, JSON.parse(jsonSchema));

        }, function ( error ) {
          logErr("onSchemaError filename:" + filepath + " error:" + JSON.stringify(error));
        }, null);

      } else {

        //Adds infoPanel for this file
        currentObj.outputPanel.addInfoPanel(getFilename(filepath), new Schema(schema));
      }
    }
  }

  this.getAnalysisSections = function (){
    //Returns the analisys tab sections and their buttons

    var pdsPlotsButtons = [];
    pdsPlotsButtons = currentObj.addButtonToArray("Lomb-Scargle Periodogram",
                                                  "periodogramBtn",
                                                  function () {
                                                    currentObj.showLcSelectionDialog("Lomb-Scargle Periodogram",
                                                                                     onPeriodogramPlotSelected);
                                                  },
                                                  pdsPlotsButtons);

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
    variancePlotsButtons = currentObj.addButtonToArray("Mean Flux Estimator",
                                                  "baselineBtn",
                                                  function () {
                                                    currentObj.showLcSelectionDialog("Mean Flux Estimator (baseline)",
                                                                                     onBaselinePlotSelected);
                                                  },
                                                  variancePlotsButtons);

    variancePlotsButtons = currentObj.addButtonToArray("Long-Term Variability",
                                                  "intVarBtn",
                                                  function () {
                                                    currentObj.showLcSelectionDialog("Long-Term Variability",
                                                                                     onAGNPlotSelected);
                                                  },
                                                  variancePlotsButtons);

    var pulsarPlotsButtons = [];
    pulsarPlotsButtons = currentObj.addButtonToArray("Phaseogram",
                                                  "phaseogramBtn",
                                                  function () {
                                                    currentObj.showLcSelectionDialog("Phaseogram",
                                                                                     onPhaseogramPlotSelected);
                                                  },
                                                  pulsarPlotsButtons);

    return [
              { cssClass: "LcPlot", title:"Light Curves and Colors" },
              { cssClass: "PDSPlot", title:"Power Density Spectra", extraButtons: pdsPlotsButtons},
              { cssClass: "TimingPlot", title:"Spectral Timing", extraButtons: timingPlotsButtons },
              { cssClass: "VariancePlot", title:"Long-Term Variability Analysis", extraButtons: variancePlotsButtons },
              { cssClass: "PulsarPlot", title:"X-ray Pulsars", extraButtons: pulsarPlotsButtons },
              { cssClass: "HdrFileInfo", title:"Header File Information" }
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
      res = JSON.parse(result);
      if (!isNull(res)){
        if (!isNull(res.error)) {
          //Error while server tried to read params.filename
          showError("Can't read file: " + params.filename);
          return;
        } else if (res == "") {
          showError("Can't concatenate files");
          return;
        } else {
          //Read success
          params.filename = res;
        }
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
    logErr("onSchemaError error:" + JSON.stringify(error));
    waitingDialog.hide();
    showError();
  }

  this.updateMinMaxCountRate = function (minRate, maxRate) {
    if (this.projectConfig.hasSchema()) {
      currentObj.toolPanel.updateCountRateSlider(Math.floor (minRate), Math.ceil (maxRate));
    }
  }

  this.onFiltersChanged = function (filters) {
    log("onFiltersChanged: filters: " + JSON.stringify(filters));
    currentObj.addToHistory("filters", filters);
    currentObj.outputPanel.onDatasetValuesChanged(filters);
  }

  this.onFiltersChangedFromPlot = function (filters) {
    log("onFiltersChangedFromPlot: filters: " + JSON.stringify(filters));
    currentObj.setCurrentPanel("filterPanel");
    currentObj.toolPanel.applyFilters(filters);
  }

  this.onTimeRangeChanged = function (timeRange) {
    this.projectConfig.setTimeRange(timeRange);
    this.toolPanel.onNumPointsChanged(this.projectConfig.getNumPoints());
  }

  this.getReplaceColumn = function () {
    return currentObj.toolPanel.getReplaceColumn();
  }

  this.broadcastEvent = function (evt_name, evt_data, senderId) {
    switch (evt_name) {
         case 'on_show':
             currentObj.toolPanel.onPlotShown(senderId)
             break;
         case 'on_hide':
             currentObj.toolPanel.onPlotHidden(senderId)
             break;
         case 'on_style_click':
             currentObj.toolPanel.onPlotStyleClicked(senderId)
             break;
         case 'on_plot_styles_changed':
             currentObj.toolPanel.onPlotStylesChanged(senderId)
             break;
         default:
             //Broadcast event to all plots
             currentObj.outputPanel.broadcastEvent(evt_name, evt_data, senderId);
     }
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
    this.prepareTabButton(this.wfSelector.find(".filterBtn"));
    this.prepareTabButton(this.wfSelector.find(".analyzeBtn"));
    this.prepareTabButton(this.wfSelector.find(".styleBtn"));
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
         plot.onSelected();
         $("#run_" + currentObj.id).prop("disabled", ($(this).parent().find(".plotSelected").length != 2));
      });

      currentObj.$html.append($xSpectraDialog);
      currentObj.createCustomDialog($xSpectraDialog, [
            {
             id: "run_" + currentObj.id,
             text: "Run Cross Spectra",
             click:function() {
               onCrossSpectraClicked(getSelectedPlots());
               $xSpectraDialog.dialog('close');
               $xSpectraDialog.remove();
             }
           },
           {
            id: "cancel_" + currentObj.id,
            text: "Cancel",
            click:function() {
              $xSpectraDialog.dialog('close');
              $xSpectraDialog.remove();
            }
          }
        ]);

      $("#run_" + currentObj.id).prop("disabled", true);
      $xSpectraDialog.parent().find(".ui-dialog-titlebar-close").html('<i class="fa fa-times" aria-hidden="true"></i>');

    } else {
      var lcPlots = currentObj.outputPanel.plots.filter(function(plot) { return plot.isSelectable() });
      showMsg("Spectral Timing:", "At least two plots of type Light Curve must be visible/enabled to continue. " +
                                  "</br> Use <i class='fa fa-eye' aria-hidden='true'></i> buttons to enable plots" +
                                  ((lcPlots.length > 4) ? "." : " or use the Load section to upload more Light Curve's files."));
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
        var btn = $(this);
        if (!btn.hasClass("plotSelected")){
          clearSelectedPlots();
          btn.parent().find(".plotSelected").removeClass("plotSelected");
          btn.addClass("plotSelected");
          var plotId = btn.attr("plotId");
          var plot = currentObj.outputPanel.getPlotById(plotId);
          plot.onSelected();
        }
        $("#run_" + currentObj.id).prop("disabled", ($(this).parent().find(".plotSelected").length != 1));
      });

      currentObj.$html.append($lcDialog);
      currentObj.createCustomDialog($lcDialog, [
            {
             id: "run_" + currentObj.id,
             text: "Run " + title,
             click:function() {
               var selectedPlots = getSelectedPlots();
               if (selectedPlots.length == 1){
                 onPlotSelectedFn(selectedPlots[0]);
                 $lcDialog.dialog('close');
                 $lcDialog.remove();
               }
             }
           },
           {
            id: "cancel_" + currentObj.id,
            text: "Cancel",
            click:function() {
              $lcDialog.dialog('close');
              $lcDialog.remove();
            }
          }
        ]);

        $("#run_" + currentObj.id).prop("disabled", true);
        $lcDialog.parent().find(".ui-dialog-titlebar-close").html('<i class="fa fa-times" aria-hidden="true"></i>');

    } else {
      showMsg(title + ":", "At least one plot of type Light Curve must be visible/enabled to continue. " +
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

  this.createCustomDialog = function ($dialogElement, buttons) {
    $dialogElement.dialog({
       width: 450,
       modal: true,
       buttons: buttons,
       close: function( event, ui ) {
         clearSelectedPlots();
         $dialogElement.remove();
       }
     });
     $dialogElement.parent().find(".ui-dialog-titlebar-close").html('<i class="fa fa-times" aria-hidden="true"></i>');
  }

  this.getDefaultPlotlyConfig = function () {
    if (isNull(this.plotDefaultConfig)){
      this.plotDefaultConfig = $.extend(true, {}, CONFIG.PLOT_CONFIG);
    }
    return this.plotDefaultConfig;
  }

  this.saveDefaultPlotlyConfig = function () {
    if (!isNull(this.plotDefaultConfig)){
      saveToFile (getFilename(currentObj.projectConfig.filename) + "_style.stl", JSON.stringify(currentObj.plotDefaultConfig));
    }
  }

  this.loadDefaultPlotlyConfig = function (onLoadedFn) {
    showLoadFile (function(e, file) {
      try {
        if (!isNull(e)) {
          currentObj.plotDefaultConfig = JSON.parse(e.target.result);
          onLoadedFn();
        } else {
          showError("File: " + file.name + " is not supported as style");
        }
     } catch (e) {
       showError("File: " + file.name + " is not supported as style", e);
     }
    }, ".stl");
  }

  this.getConfig = function () {
    return { type: "WfTabPanel",
             id: this.id,
             navItemClass: this.navItemClass,
             projectConfig: this.projectConfig.getConfig(),
             toolPanelConfig: this.toolPanel.getConfig(this.projectConfig),
             outputPanelConfig: this.outputPanel.getConfig(),
             plotDefaultConfig: this.plotDefaultConfig
           };
  }

  this.setConfig = function (tabConfig, callback) {
    log("setConfig for tab " + this.id);

    async.waterfall([
        function(callback) {
            if (!isNull(tabConfig.plotDefaultConfig)){
              currentObj.plotDefaultConfig = $.extend(true, {}, tabConfig.plotDefaultConfig);
            }
            callback();
        },
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
          logErr("setConfig on tab " + currentObj.id + " error: " + err);
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
      delete this.plotDefaultConfig

      delete this.id;
    } catch (ex) {
      logErr("Destroy tab " + this.id + " error: " + ex);
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
                                  this.enableDragDrop,
                                  this);

  this.outputPanel = new WfOutputPanel (this.id + "_wfOutputPanel",
                                      "OutputPanelTemplate",
                                      this.$html.find(".outputPanelContainer"),
                                      this.service,
                                      this.onFiltersChangedFromPlot,
                                      this.toolPanel.getFilters );

  $(window).resize(function () { if (!isNull(currentObj.outputPanel)){currentObj.outputPanel.resize();} });

  this.prepareTabButton(this.wfSelector.find(".loadBtn"));

  this.setCurrentPanel("loadPanel");
  this.wfSelector.find(".loadBtn").parent().addClass('active');
  this.wfSelector.find(".wfSelectorDisableable").hide();

  log("WfTabPanel ready! id: " + this.id);

  return this;
}
