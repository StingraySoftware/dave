var tabPanels = [];
var waitingTab = null;

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

  this.projectConfig = new ProjectConfig();

  //TAB_PANEL METHODS AND EVENTS HANDLERS
  this.setTitle = function ( title ) {
    this.$navItem.find("." + this.navItemClass).html(title);
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

  this.onSrcDatasetChanged = function ( filenames ) {

    if (filenames.length == 1) {

      currentObj.projectConfig.filename = filenames[0];
      waitingDialog.show('Getting file schema: ' + currentObj.projectConfig.filename);
      log("onSrcDatasetChanged:" + currentObj.projectConfig.filename);
      currentObj.service.get_dataset_schema(currentObj.projectConfig.filename, currentObj.onSchemaChanged, currentObj.onSchemaError, null);

    } else if (filenames.length > 1){

      currentObj.projectConfig.filenames = filenames;
      currentObj.projectConfig.filename = filenames[0];
      var params = { filename: currentObj.projectConfig.filename, filenames: currentObj.projectConfig.filenames, currentFile: 1, onSchemaChanged:currentObj.onSchemaChanged };
      currentObj.onSchemaChangedMultipleFiles(null, params);

    } else {
      log("onSrcDatasetChanged: No selected files..");
    }

  }

  this.onSchemaChanged = function ( schema, params ) {
    log("onSchemaChanged:" + schema);

    if (params !== undefined && params != null){
      currentObj.projectConfig.filenames = params.filenames;
      currentObj.projectConfig.filename = params.filename;
    }

    var jsonSchema = JSON.parse(schema);
    if (isNull(jsonSchema.error)){

      currentObj.projectConfig.schema = jsonSchema;

      // Sets the time unit
      if (!isNull(currentObj.projectConfig.schema["EVENTS"])
          && !isNull(currentObj.projectConfig.schema["EVENTS"]["HEADER"])
          && !isNull(currentObj.projectConfig.schema["EVENTS"]["HEADER"]["TUNIT1"])) {
        currentObj.theTimeUnit = parseFloat(currentObj.projectConfig.schema["EVENTS"]["HEADER"]["TUNIT1"]);
      }

      // Sets the time unit
      if (!isNull(currentObj.projectConfig.schema["RATE"])
          && !isNull(currentObj.projectConfig.schema["RATE"]["HEADER"])
          && !isNull(currentObj.projectConfig.schema["RATE"]["HEADER"]["TIMEDEL"])) {
        currentObj.theBinSize = parseFloat(currentObj.projectConfig.schema["RATE"]["HEADER"]["TIMEDEL"]);
      }

      currentObj.setTitle(currentObj.projectConfig.filename);
      currentObj.toolPanel.onDatasetSchemaChanged(currentObj.projectConfig);
      currentObj.refreshPlotsData();

    } else {
      log("onSchemaChanged error:" + schema);
      waitingDialog.hide();
    }
  }

  this.onBckSchemaChanged = function ( schema, params ) {
    log("onBckDatasetChanged:" + schema);

    if (params !== undefined && params != null){
      currentObj.projectConfig.bckFilenames = params.filenames;
      currentObj.projectConfig.bckFilename = params.filename;
    }

    var jsonSchema = JSON.parse(schema);
    if (isNull(jsonSchema.error)){
      if (currentObj.projectConfig.schema != null) {
        currentObj.refreshPlotsData();
      } else {
        waitingDialog.hide();
      }
    } else {
      log("onBckSchemaChanged error:" + schema);
      waitingDialog.hide();
    }
  }

  this.onGtiSchemaChanged = function ( schema, params ) {
    log("onGtiSchemaChanged:" + schema);

    if (params !== undefined && params != null){
      currentObj.projectConfig.gtiFilenames = params.filenames;
      currentObj.projectConfig.gtiFilename = params.filename;
    }

    var jsonSchema = JSON.parse(schema);
    if (isNull(jsonSchema.error)){
      if (currentObj.projectConfig.schema != null) {
        currentObj.refreshPlotsData();
      } else {
        waitingDialog.hide();
      }
    } else {
      log("onGtiSchemaChanged error:" + schema);
      waitingDialog.hide();
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

  this.onBckDatasetChanged = function ( filenames ) {

    if (filenames.length == 1) {

      currentObj.projectConfig.bckFilename = filenames[0];
      waitingDialog.show('Getting file schema: ' + currentObj.projectConfig.bckFilename);
      log("onBckDatasetChanged:" + currentObj.projectConfig.bckFilename);
      currentObj.service.get_dataset_schema(currentObj.projectConfig.bckFilename, currentObj.onBckSchemaChanged);

    } else if (filenames.length > 1){

      currentObj.projectConfig.bckFilenames = filenames;
      currentObj.projectConfig.bckFilename = filenames[0];
      var params = { filename: this.projectConfig.bckFilename, filenames: currentObj.projectConfig.bckFilenames, currentFile: 1, onSchemaChanged:currentObj.onBckSchemaChanged };
      currentObj.onSchemaChangedMultipleFiles(null, params);

    } else {
      log("onBckDatasetChanged: No selected files..");
    }

  }

  this.onGtiDatasetChanged = function ( filenames ) {

    if (filenames.length == 1) {

      currentObj.projectConfig.gtiFilename = filenames[0];
      waitingDialog.show('Getting file schema: ' + currentObj.projectConfig.gtiFilename);
      log("onGtiDatasetChanged:" + currentObj.projectConfig.gtiFilename);
      currentObj.service.get_dataset_schema(currentObj.projectConfig.gtiFilename, currentObj.onGtiSchemaChanged);

    } else if (filenames.length > 1){

      currentObj.projectConfig.gtiFilenames = filenames;
      currentObj.projectConfig.gtiFilename = filenames[0];
      var params = { filename: currentObj.projectConfig.gtiFilename, filenames: currentObj.projectConfig.gtiFilenames, currentFile: 1, onSchemaChanged:currentObj.onGtiSchemaChanged };
      currentObj.onSchemaChangedMultipleFiles(null, params);

    } else {
      log("onGtiDatasetChanged: No selected files..");
    }

  }

  this.refreshPlotsData = function (schema) {
    currentObj.outputPanel.onDatasetChanged(currentObj.projectConfig);
    currentObj.outputPanel.onDatasetValuesChanged(currentObj.projectConfig.filename, currentObj.toolPanel.getFilters());
  }

  this.onFiltersChanged = function (filters) {
    log("onFiltersChanged:" + currentObj.projectConfig.filename + ", filters: " + JSON.stringify(filters));
    currentObj.outputPanel.onDatasetValuesChanged(currentObj.projectConfig.filename, filters);
  }

  this.onFiltersChangedFromPlot = function (filters) {
    log("onFiltersChangedFromPlot: filters: " + JSON.stringify(filters));
    currentObj.toolPanel.applyFilters(filters);
  }


  //TAB_PANEL INITIALIZATION
  this.wfSelector = this.$html.find(".wfSelectorContainer");

  this.toolPanel = new ToolPanel (this.id + "_toolPanel", "ToolPanelTemplate", this.$html.find(".toolPanelContainer"), service, this.onSrcDatasetChanged, this.onBckDatasetChanged, this.onGtiDatasetChanged, this.onFiltersChanged);
  this.outputPanel = new OutputPanel (this.id + "_outputPanel", "OutputPanelTemplate", ".outputPanelToolBar", this.$html.find(".outputPanelContainer"), service, this.onFiltersChangedFromPlot);
  $(window).resize(function () { currentObj.outputPanel.resize(); });

  this.prepareButton(this.wfSelector.find(".loadBtn"), "loadPanel");
  this.prepareButton(this.wfSelector.find(".filterBtn"), "filterPanel");
  this.prepareButton(this.wfSelector.find(".analyzeBtn"), "analyzePanel");
  this.prepareButton(this.wfSelector.find(".styleBtn"), "stylePanel");

  this.setCurrentPanel("loadPanel");
  this.wfSelector.find(".loadBtn").parent().addClass('active');

  this.$navItem.find("." + this.navItemClass).bind("click", function( event ) {
    currentObj.show();
  });

  navBarList.prepend(this.$navItem);
  panelContainer.append(this.$html);
  this.show();

  log("TabPanel ready! id: " + this.id);
}


//STATIC TAB_PANEL METHODS

function getTabForSelector (selectorId) {
  for (t in tabPanels) {
    var tab = tabPanels[t];

    for (i in tab.toolPanel.selectors_array) {
      if (!isNull(tab.toolPanel.selectors_array[selectorId])) {
          return tab;
      }
    }

    for (i in tab.outputPanel.plots) {
      if (tab.outputPanel.plots[i].id == selectorId) {
          return tab;
      }
    }

    if (tab.toolPanel.id == selectorId) {
        return tab;
    }

    if (!isNull(tab.toolPanel.binSelector) && tab.toolPanel.binSelector.id == selectorId) {
        return tab;
    }

    if (!isNull(tab.toolPanel.srcFileSelector) && tab.toolPanel.srcFileSelector.id == selectorId) {
        return tab;
    }

    if (!isNull(tab.toolPanel.bckFileSelector) && tab.toolPanel.bckFileSelector.id == selectorId) {
        return tab;
    }

    if (!isNull(tab.toolPanel.gtiFileSelector) && tab.toolPanel.gtiFileSelector.id == selectorId) {
        return tab;
    }

  }

  return null;
}
