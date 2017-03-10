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

  this.onDatasetChanged = function ( filenames, selectorKey ) {

    if (filenames.length == 1) {

      currentObj.projectConfig.setFiles(selectorKey, [], filenames[0]);
      waitingDialog.show('Getting file schema: ' + currentObj.projectConfig.filename);
      log("onDatasetChanged " + selectorKey + ": " + currentObj.projectConfig.filename);
      if (selectorKey == "SRC") {
        currentObj.service.get_dataset_schema(currentObj.projectConfig.filename, currentObj.onSrcSchemaChanged, currentObj.onSchemaError, null);
      } else if (selectorKey == "BCK") {
        currentObj.service.get_dataset_schema(currentObj.projectConfig.bckFilename, currentObj.onBckSchemaChanged);
      } else if (selectorKey == "GTI") {
        currentObj.service.get_dataset_schema(currentObj.projectConfig.gtiFilename, currentObj.onGtiSchemaChanged);
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

        var lcab_Added = currentObj.tryAddDividedLightCurve("LCA", "LCB", "A/B");
        var lccd_Added = currentObj.tryAddDividedLightCurve("LCC", "LCD", "C/D");

        if (!lcab_Added && ! lccd_Added) {
          waitingDialog.hide();
        }

      } else {
        waitingDialog.hide();
      }

    } else if (filenames.length > 1){
      log("onLcDatasetChanged " + selectorKey + ": Multifile selection not supported yet..");
      waitingDialog.hide();
    } else {
      log("onLcDatasetChanged " + selectorKey + ": No selected files..");
      waitingDialog.hide();
    }

  }

  this.tryAddDividedLightCurve = function (key0, key1, newKeySufix) {
    var data = {};
    data.lc0_filename = currentObj.projectConfig.getFile(key0);
    data.lc1_filename = currentObj.projectConfig.getFile(key1);

    var newKey = "LC_" + newKeySufix;

    if ((data.lc0_filename != "") && (data.lc1_filename != "") && (currentObj.projectConfig.getFile(newKey) == "")){
      //Prepares newKey dataset and adds the plot to output panel
      currentObj.service.request_divided_lightcurve_ds(data, function (result) {
        var cache_key = JSON.parse(result);
        log("request_divided_lightcurve_ds Result: " + newKey + " --> " + cache_key);
        if (cache_key != "") {

          currentObj.projectConfig.setFile(newKey, cache_key);
          lc_plot = currentObj.outputPanel.getLightCurvePlot ( cache_key,
                                                                  currentObj.projectConfig.binSize,
                                                                  currentObj.projectConfig.timeUnit,
                                                                  "", false);
          lc_plot.plotConfig.styles.labels[1] = newKeySufix + " Count Rate(c/s)";
          currentObj.projectConfig.plots.push(lc_plot);
          currentObj.outputPanel.appendPlot(lc_plot);
          lc_plot.onDatasetValuesChanged(currentObj.toolPanel.getFilters());

          //After getting A/B or C/D we can calculate the Hardness and Softnes Intensity lcs
          if (newKeySufix == "A/B") {

            lc_src_filename = currentObj.projectConfig.getFile("SRC");
            lc_softness_plot = currentObj.outputPanel.getJoinedLightCurvesPlot ( lc_src_filename,
                                                                        cache_key,
                                                                        currentObj.projectConfig.binSize,
                                                                        currentObj.projectConfig.timeUnit,
                                                                        "", false);
            lc_softness_plot.plotConfig.styles.labels[1] = newKeySufix + " Count Rate(c/s)";
            currentObj.projectConfig.plots.push(lc_softness_plot);
            currentObj.outputPanel.appendPlot(lc_softness_plot);
            lc_softness_plot.onDatasetValuesChanged(currentObj.toolPanel.getFilters());

          } else if (newKeySufix == "C/D") {

            lc_src_filename = currentObj.projectConfig.getFile("SRC");
            lc_hardness_plot = currentObj.outputPanel.getJoinedLightCurvesPlot ( lc_src_filename,
                                                                        cache_key,
                                                                        currentObj.projectConfig.binSize,
                                                                        currentObj.projectConfig.timeUnit,
                                                                        "", true);
            lc_hardness_plot.plotConfig.styles.labels[1] = newKeySufix + " Count Rate(c/s)";
            currentObj.projectConfig.plots.push(lc_hardness_plot);
            currentObj.outputPanel.appendPlot(lc_hardness_plot);
            lc_hardness_plot.onDatasetValuesChanged(currentObj.toolPanel.getFilters());

          }

        } else {
          log("request_divided_lightcurve_ds WRONG CACHE KEY!!");
        }
      });

      return true;
    }

    return false;
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
        currentObj.refreshPlotsData();

      } else {

        if (currentObj.projectConfig.hasSchema()) {
          currentObj.refreshPlotsData();
        } else {
          waitingDialog.hide();
        }

      }

    } else {
      log("onSchemaChangedWithKey error:" + schema);
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

  this.refreshPlotsData = function () {
    currentObj.outputPanel.onDatasetChanged(currentObj.projectConfig);
    currentObj.outputPanel.onDatasetValuesChanged(currentObj.toolPanel.getFilters());
  }

  this.onFiltersChanged = function (filters) {
    log("onFiltersChanged: filters: " + JSON.stringify(filters));
    currentObj.outputPanel.onDatasetValuesChanged(filters);
  }

  this.onFiltersChangedFromPlot = function (filters) {
    log("onFiltersChangedFromPlot: filters: " + JSON.stringify(filters));
    currentObj.toolPanel.applyFilters(filters);
  }


  //TAB_PANEL INITIALIZATION
  this.wfSelector = this.$html.find(".wfSelectorContainer");

  this.toolPanel = new ToolPanel (this.id + "_toolPanel",
                                  "ToolPanelTemplate",
                                  this.$html.find(".toolPanelContainer"),
                                  this.service,
                                  this.onDatasetChanged,
                                  this.onLcDatasetChanged,
                                  this.onFiltersChanged);

  this.outputPanel = new OutputPanel (this.id + "_outputPanel",
                                      "OutputPanelTemplate",
                                      this.$html.find(".outputPanelContainer"),
                                      this.service,
                                      this.onFiltersChangedFromPlot);

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

    if (tab.toolPanel.containsId(selectorId)) {
        return tab;
    }

    if (tab.outputPanel.containsId(selectorId)) {
        return tab;
    }
  }

  return null;
}
