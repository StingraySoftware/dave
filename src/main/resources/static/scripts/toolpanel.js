
function ToolPanel (id,
                    classSelector,
                    container,
                    service,
                    onDatasetChangedFn,
                    onLcDatasetChangedFn,
                    onFiltersChangedFn,
                    historyManager,
                    onDragDropChangedFn,
                    tabPanel)
{

  var currentObj = this;

  this.id = id;
  this.classSelector = classSelector;
  this.$html = cloneHtmlElement(id, classSelector);
  container.html(this.$html);
  this.$html.show();
  this.filters = [];
  this.loadFileType = "Single"; // Supported: Single, Concatenated

  this.buttonsContainer = this.$html.find(".buttonsContainer");
  this.analyzeContainer = this.$html.find(".analyzeContainer");
  this.styleContainer = this.$html.find(".styleContainer");
  this.clearBtn = this.$html.find(".btnClear");
  this.undoBtn = this.$html.find(".btnUndo");
  this.loadBtn = this.$html.find(".btnLoad");
  this.saveBtn = this.$html.find(".btnSave");
  this.refreshBtn = this.$html.find(".btnRefresh");
  this.refreshFloatingBtn = this.$html.find(".btnRefreshFloating");
  this.dragDropBtn = this.$html.find(".btnDragDrop");

  this.onDatasetChangedFn = onDatasetChangedFn;
  this.onLcDatasetChangedFn = onLcDatasetChangedFn;
  this.onFiltersChanged = onFiltersChangedFn;
  this.historyManager = historyManager;
  this.onDragDropChanged = onDragDropChangedFn;

  this.lastTimeoutId = null;
  this.dragDropEnabled = false;

  this.file_selectors_ids_array = [];
  this.file_selectors_array = [];
  this.selectors_array = [];
  this.channelColumn = "PHA";
  this.replaceColumn = "PHA";

  this.tabPanel = isNull(tabPanel) ? null : tabPanel;

  this.addFileSelector = function (selector, container) {
    if (isNull(container)){
      container = this.$html.find(".fileSelectorsContainer");
    }
    container.append(selector.$html);
    this.file_selectors_ids_array.push(selector.id);
    this.file_selectors_array.push(selector);
  }

  this.clearFileSelectors = function () {
    this.$html.find(".fileSelectorsContainer").html("");
    this.file_selectors_ids_array = [];
  }

  this.addSelectedFile = function (label, filename) {
    var $selectedFile = $('<div class="fileSelector">' +
                            '<h3>' + label + '</h3>' +
                            '<label class="fileBtn">' + filename + '</label>' +
                          '</div>');
     this.$html.find(".fileSelectorsContainer").append($selectedFile);
  }

  this.setInfoTextToFileSelector = function (selectorKey, infoText, hideButtons) {
    var fileSelector = this.getFileSelector(selectorKey);
    if (!isNull(fileSelector)) {
      fileSelector.showInfoText(infoText, hideButtons);
    }
  }

  this.getFileSelector = function (selectorKey) {
    for (idx in this.file_selectors_array) {
      var selector = this.file_selectors_array[idx];
      if (selector.selectorKey == selectorKey) {
        return selector;
      }
    }

    return null;
  }

  this.resetFileSelectors = function (excludeKey) {
    for (idx in this.file_selectors_array) {
      var selector = this.file_selectors_array[idx];
      if (isNull(excludeKey) || selector.selectorKey != excludeKey) {
        selector.reset();
      }
    }
  }

  this.showEventsSelectors = function () {
    this.srcFileSelector.$html.find("h3").text("Event file:");
    this.bckFileSelector.show();
    this.gtiFileSelector.show();
    this.rmfFileSelector.show();
    this.lcBckFileSelector.hide();
    this.lcAFileSelector.hide();
    this.lcBFileSelector.hide();
    this.lcCFileSelector.hide();
    this.lcDFileSelector.hide();
    this.lcABckFileSelector.hide();
    this.lcBBckFileSelector.hide();
    this.lcCBckFileSelector.hide();
    this.lcDBckFileSelector.hide();
  }

  this.showLcSelectors = function () {
    this.srcFileSelector.$html.find("h3").text("Total light curve:");
    this.gtiFileSelector.hide();
    this.rmfFileSelector.hide();
    this.bckFileSelector.hide();
    this.lcBckFileSelector.show();
    this.lcAFileSelector.show();
    this.lcBFileSelector.show();
    this.lcCFileSelector.show();
    this.lcDFileSelector.show();
    this.lcABckFileSelector.hide();
    this.lcBBckFileSelector.hide();
    this.lcCBckFileSelector.hide();
    this.lcDBckFileSelector.hide();
  }

  this.showPanel = function ( panel ) {
    this.$html.find(".panelContainer").hide();
    this.$html.find("." + panel).show();

    if (panel == "stylePanel"){
      this.refreshPlotStylingControls();
    }
  }

  this.createSngOrMultiFileSelector = function () {
    // Creates Single file or Multifile selection radio buttons
    this.sngOrMultiFileSelector = getRadioControl(this.id,
                                      "Choose single or multiple files to load",
                                      "SngOrMultiFile",
                                      [
                                        { id:"SngFile", label:"Single file", value:"Single"},
                                        { id:"ConFile", label:"Multiple files", value:"Concatenated"}
                                      ],
                                      "Single",
                                      function(value, id) {
                                        currentObj.loadFileType = value;
                                        for (idx in currentObj.file_selectors_array) {
                                          var fileSelector = currentObj.file_selectors_array[idx];
                                          fileSelector.setMultiFileEnabled(value != "Single"
                                                                           && (fileSelector.selectorKey != "RMF")
                                                                           && (!fileSelector.selectorKey.startsWith("LC")));
                                        }
                                      });
    this.$html.find(".fileSelectorsContainer").append(this.sngOrMultiFileSelector);

    //Adds supported formats link button
    var btnSupportedFormats = $('<a href="#" class="btnSupportedFormats floatRight InfoText" style="margin-top: 23px;">Supported formats <i class="fa fa-info-circle" aria-hidden="true"></i></a>');
    btnSupportedFormats.click(function () {
      showMsg("DAVE supported file formats",
              "<p><strong>Data types:</strong> Light curves and event files.</p>" +
              "<p><strong>Data formats:</strong> FITS, gzipped FITS, CSV.</p>" +
              "<p><strong>Multiple data files:</strong> Metafiles with one file per line with absolute path.</p>" +
              "<hr><p><strong>Other DAVE file formats:</strong></p>" +
              "<p><strong>*.wsp:</strong> Workspace file format.</p>" +
              "<p><strong>*.flt:</strong> Filters file format.</p>" +
              "<p><strong>*.mdl:</strong> Fit models file format.</p>");
      gaTracker.sendEvent("LoadPage", "SupportedFormats", currentObj.id);
    });
    this.$html.find(".fileSelectorsContainer").append(btnSupportedFormats);
  }

  this.removeSngOrMultiFileSelector = function () {
    this.sngOrMultiFileSelector.remove();
    this.$html.find(".fileSelectorsContainer").find(".btnSupportedFormats").remove();
  }

  /*this.onTimeRangeChanged = function (timeRange) {
    if (CONFIG.AUTO_BINSIZE && !isNull(this.binSelector)){
      if (!isNull(this.tabPanel)){
        var minValue = Math.max(timeRange / CONFIG.MAX_PLOT_POINTS, this.tabPanel.projectConfig.minBinSize);
        var maxValue = Math.max(Math.min(timeRange / CONFIG.MIN_PLOT_POINTS, this.tabPanel.projectConfig.maxBinSize), minValue * CONFIG.MIN_PLOT_POINTS);
        this.binSelector.setMinMaxValues(minValue, maxValue);
      }
    }
  }*/

  this.onBinSizeChanged = function () {
    currentObj.onSelectorValuesChanged();
    if (!isNull(currentObj.tabPanel)){
      if (!isNull(currentObj.timeSelector)) {
        currentObj.timeSelector.setFixedStep(currentObj.tabPanel.projectConfig.binSize, false);
      }
      currentObj.onNumPointsChanged(currentObj.tabPanel.projectConfig.getNumPoints());
    }
  }

  this.onNumPointsChanged = function (numPoints) {
    if (numPoints > CONFIG.MAX_PLOT_POINTS) {
      this.showWarn("You are about to plot " + numPoints + " points. Performance will be degraded.");
    } else {
      this.showWarn("");
    }
  }

  this.showWarn = function (msg) {
    this.$html.find(".selectorsContainer").find(".btnWarn").remove();
    if (!isNull(msg) && msg != ""){
      this.$html.find(".selectorsContainer").prepend($('<a href="#" class="btn btn-danger btnWarn"><div>' +
                                                          '<i class="fa fa-exclamation-triangle" aria-hidden="true"></i> ' + msg +
                                                        '</div></a>'));
    }
  }

  this.onDatasetSchemaChanged = function ( projectConfig ) {

    currentObj.selectors_array = [];
    currentObj.$html.find(".sliderSelector").remove();

    //Adds the Bin selector
    if (!isNull(this.binSelector)){
      this.binSelector.$html.remove();
    }

    this.removeSngOrMultiFileSelector();
    this.resetFileSelectors("SRC");

    var excludedFilters = $.extend(true, [], CONFIG.EXCLUDED_FILTERS);

    if (projectConfig.schema.isEventsFile()){

      this.showEventsSelectors();

      //Sets RMF fileSelector message depending on channel column
      var rmfMessage = "";
      this.channelColumn = projectConfig.getChannelColumn();
      if (!projectConfig.schema.hasColumn(this.channelColumn)){
          //channelColumn Column doesn't exist, show we can't apply RMF file
          rmfMessage = this.channelColumn + " column not found in Event file";
      } else if (projectConfig.schema.getTable()[this.channelColumn].min_value >= projectConfig.schema.getTable()[this.channelColumn].max_value){
          //channelColumn is empty, show we can't apply RMF file
          rmfMessage = this.channelColumn + " column is empty in Event file";
      }

      if ((rmfMessage != "") || (this.channelColumn == "PI")){
        //Remove PI from excludedFilters if there is rmfMessage or channel column is PI
        excludedFilters = excludedFilters.filter(function(column) { return column != "PI"; });
      }
      this.rmfFileSelector.disable(rmfMessage);

      //Caluculates intial, max, min and step values for slider with time ranges
      var binSelectorConfig = getBinSelectorConfig(projectConfig);

      projectConfig.binSize = binSelectorConfig.binSize;

      this.binSelector = new BinSelector(this.id + "_binSelector",
                                        "Bin Size (" + projectConfig.timeUnit  + "):",
                                        binSelectorConfig.minBinSize,
                                        binSelectorConfig.maxBinSize,
                                        binSelectorConfig.step,
                                        binSelectorConfig.binSize,
                                        this.onBinSizeChanged,
                                        null, CONFIG.MAX_TIME_RESOLUTION_DECIMALS, "log");

      this.$html.find(".selectorsContainer").append(this.binSelector.$html);

    } else if (projectConfig.schema.isLightCurveFile()){

      //Prepares file selectors for lightcurve
      this.showLcSelectors();
      this.srcFileSelector.showInfoText(extractEnergyRangeTextFromSchema(projectConfig.schema));
      this.lcBckFileSelector.showInfoText((projectConfig.backgroundSubstracted ? "Background already substracted" : ""), CONFIG.DENY_BCK_IF_SUBS);

      //Sets fixed binSize panel
      var binDiv = $('<div class="sliderSelector binLabel">' +
                      '<h3>Bin Size (' + projectConfig.timeUnit  + '): ' + projectConfig.binSize + '</h3>' +
                    '</div>');
      this.$html.find(".selectorsContainer").append(binDiv);
    }

    var channel_column_data = null;

    //Adds the rest of selectors from dataset columns
    for (tableName in projectConfig.schema.contents) {
      if (tableName != "GTI") {
        var table = projectConfig.schema.contents[tableName];

        for (columnName in table) {
          var column = table[columnName];
          if (!excludedFilters.includes(columnName) && column.min_value < column.max_value) {

            var multiplier = 1.0;
            var filterData = { table:tableName, column:columnName };
            var columnTitle = toProperCase(columnName + ":");
            if (columnName == CONFIG.TIME_COLUMN) {
               columnTitle = "Time (" + projectConfig.timeUnit  + "):";
            } else if ((columnName == "RATE") && projectConfig.schema.isLightCurveFile()){
               //This multiplier its only intended to calculate CountRate from counts when BinSize != 1
               //The RATE values that comes from schema means counts, but filters and LCs shows countrate
               //so a multiplication by binSize is requiered for calculating the rate.
               multiplier = projectConfig.binSize;
            }

            //Sets the slider precision
            var precision = CONFIG.DEFAULT_NUMBER_DECIMALS;
            if (tableName == "EVENTS" && columnName == projectConfig.getChannelColumn()) {
              channel_column_data = column;
              precision = 0;
            } else if (columnName == CONFIG.TIME_COLUMN){
              precision = CONFIG.MAX_TIME_RESOLUTION_DECIMALS;
            }

            var selector = new sliderSelector(this.id + "_" + columnName,
                                              columnTitle,
                                              filterData,
                                              Math.floor(column.min_value / multiplier),
                                              Math.ceil(column.max_value / multiplier),
                                              (columnName != CONFIG.TIME_COLUMN) ?
                                                this.onSelectorValuesChanged :
                                                function (selector) {
                                                //Notifies that time range has changed
                                                if (!isNull(currentObj.tabPanel)){
                                                  currentObj.tabPanel.onTimeRangeChanged(Math.max ((selector.toValue - selector.fromValue), selector.step));
                                                }
                                              },
                                              this.selectors_array,
                                              null, precision);
            selector.multiplier = multiplier;
            this.$html.find(".selectorsContainer").append(selector.$html);

            if (columnName == CONFIG.TIME_COLUMN){

              //Stores this selector
              this.timeSelector = selector;

              if ((!CONFIG.AUTO_BINSIZE || projectConfig.schema.isLightCurveFile())
                  && projectConfig.isMaxTimeRangeRatioFixed()) {

                    //If full events were cropped to CONFIG.MAX_PLOT_POINTS
                    //selector.setMaxRange(projectConfig.getMaxTimeRange());
                    selector.setValues( selector.initFromValue, selector.initFromValue + projectConfig.getMaxTimeRange() );
                    selector.setEnabled (true);
              }
            }
          }
        }

        this.buttonsContainer.removeClass("hidden");
        this.buttonsContainer.fadeIn();
        this.analyzeContainer.removeClass("hidden");
        this.styleContainer.removeClass("hidden");
      }
    }

    if (channel_column_data != null){

      // Creates colors filter type (channelColumn by default or ENERGY with RMF file upload requisite)
      this.colorFilterTypeRadios = $('<div class="colorFilterType">' +
                                      '<h3>Energy range filter type:</h3>' +
                                      '<fieldset>' +
                                        '<label for="' + this.id + '_Channel">Channel</label>' +
                                        '<input type="radio" name="' + this.id + '_ColorFilterType" id="' + this.id + '_Channel" value="' + this.channelColumn + '" checked="checked">' +
                                        '<label for="' + this.id + '_Energy">Energy (keV)</label>' +
                                        '<input type="radio" name="' + this.id + '_ColorFilterType" id="' + this.id + '_Energy" value="E">' +
                                      '</fieldset>' +
                                    '</div>');

      this.$html.find(".selectorsContainer").append(this.colorFilterTypeRadios);
      var $typeRadios = this.colorFilterTypeRadios.find("input[type=radio][name=" + this.id + "_ColorFilterType]")
      $typeRadios.checkboxradio();
      this.colorFilterTypeRadios.find("fieldset").controlgroup();
      $typeRadios.change(function() {
        currentObj.onColorFilterTypeChanged(this.value);
        gaTracker.sendEvent("LoadPage", "colorFilterTypeRadios_" + this.value, currentObj.id);
      });

      //Adds color selectors, Channel filters
      this.createColorSelectors (channel_column_data);

    } else if (projectConfig.schema.isEventsFile()){
      // Shows can't find channel column in Event file
      var colorFilterTypeMsg = $('<div class="colorFilterType Orange">' +
                                    '<h5></br>Energy range filter: </br> No channel column ( ' + this.channelColumn + ' ) found in Event file</h5>' +
                                  '</div>');

      this.$html.find(".selectorsContainer").append(colorFilterTypeMsg);
    }

    //Sets initial filters to ToolPanel
    currentObj.filters = sliderSelectors_getFilters(currentObj.selectors_array);
  }

  this.createColorSelectors = function (column) {
    var selectorNames = ["A", "B", "C", "D"];
    var increment = (column.max_value - column.min_value) * (1 / selectorNames.length);
    var container = $("<div class='colorSelectors_" + column.id + "'></div>");
    var mustAppend = false;

    for (i in selectorNames) {
      var selectorName = selectorNames[i];
      var selectorKey = "Color_" + selectorName;
      var sliderId = this.id + "_selector_" + selectorKey + "_" + column.id;
      var min_value = column.min_value + (increment * i);
      var max_value = min_value + increment;
      var selector = sliderSelectors_getSelector(this.selectors_array, sliderId);

      if (isNull(selector)) {
        //Creates new selector
        mustAppend = true;
        var filterData = { table:"EVENTS", column:selectorKey, source:"ColorSelector", replaceColumn: column.id };
        selector = new sliderSelector(sliderId,
                                      ((column.id == this.channelColumn) ? "Channel" : "Energy") + " range " + selectorName + ":",
                                      filterData,
                                      column.min_value, column.max_value,
                                      this.onSelectorValuesChanged,
                                      this.selectors_array);
        if (column.id == this.channelColumn) {
          selector.precision = 0;
        } else {
          selector.setFixedStep(CONFIG.ENERGY_FILTER_STEP);
        }
        selector.setValues (min_value, max_value);
        selector.setEnabled (true);
        container.append(selector.$html);

      } else {
        //Udpate selector min and max values
        selector.setMinMaxValues(column.min_value, column.max_value);
        selector.setValues (min_value, max_value);
      }
    }

    if (mustAppend){
      this.$html.find(".colorSelectorsContainer").append(container);
      this.$html.find(".colorSelectorsContainer").removeClass("hidden");
    }
  }

  this.onRmfDatasetUploaded = function ( schema ) {
    if (schema.isEventsFile()) {
      var column = schema.getTable()["E"];
      if (!isNull(column)){
        var energySliderId = this.id + "_Energy";
        var selector = sliderSelectors_getSelector(this.selectors_array, energySliderId);
        if (isNull(selector)) {
          //Adds energy general filter selector
          selector = new sliderSelector(energySliderId,
                                            "Energy (keV):",
                                            { table:"EVENTS", column:"E" },
                                            column.min_value, column.max_value,
                                            this.onSelectorValuesChanged,
                                            this.selectors_array);
          selector.setFixedStep(CONFIG.ENERGY_FILTER_STEP);
          selector.$html.insertAfter("." + this.id + "_TIME");
        } else {

          //Udpate energy selector min and max values
          selector.setMinMaxValues(column.min_value, column.max_value);
        }

        //Prepares Energy color filters
        this.createColorSelectors(column);
        this.onColorFilterTypeChanged("E");
        this.setColorFilterRadios("E");
      }
    }
  }

  this.updateCountRateSlider = function ( minRate, maxRate ) {
    var rateSliderId = this.id + "_RATE";
    if (isNull(getTabForSelector(rateSliderId))) {

      //Creates the rate slider if not created yet:
      var rateSelector = new sliderSelector(rateSliderId,
                                            "Count Rate (c/s):",
                                            { table:"EVENTS", column:"RATE" },
                                            minRate, maxRate,
                                            this.onSelectorValuesChanged,
                                            this.selectors_array,
                                            null, CONFIG.DEFAULT_NUMBER_DECIMALS);
      rateSelector.$html.insertAfter("." + this.id + "_TIME");

    } else {

      //Udpate rate slider min and max values
      var rateSelector = sliderSelectors_getSelector(currentObj.selectors_array, rateSliderId);
      if (!isNull(rateSelector)) {
        var newMinRate = Math.min(rateSelector.initFromValue, minRate);
        var newMaxRate = Math.max(rateSelector.initToValue, maxRate);
        if ((newMinRate != rateSelector.initFromValue)
            || (newMaxRate != rateSelector.initToValue)) {
              rateSelector.setMinMaxValues(newMinRate, newMaxRate);
            }
      }

    }

  }

  this.setColorFilterRadios = function (column) {
    var colorFilterTypeRadios = this.$html.find(".colorFilterType").find("input");
    colorFilterTypeRadios.filter('[value=' + this.channelColumn + ']').prop('checked', column == this.channelColumn).checkboxradio('refresh');
    colorFilterTypeRadios.filter('[value=E]').prop('checked', column == "E").checkboxradio('refresh');
  }

  //Called to set selector values when plot area has selected
  this.applyFilters = function (filters) {
    sliderSelectors_applyFilters(filters, currentObj.selectors_array);
  }

  //Called for setting filters after undo or clear action, or load filters file
  this.setFilters = function (filters) {
    for (f in filters) {
      if (!isNull(filters[f].source)
        && !isNull(filters[f].replaceColumn)
        && filters[f].source == 'ColorSelector') {
        //Sets Energy or Channels filters visible
        var selectorsContainer = currentObj.$html.find(".colorSelectorsContainer");
        var showChannel = (currentObj.tabPanel.projectConfig.rmfFilename == "") || (filters[f].replaceColumn == currentObj.channelColumn);
        setVisibility(selectorsContainer.find(".colorSelectors_" + currentObj.channelColumn), showChannel);
        setVisibility(selectorsContainer.find(".colorSelectors_E"), !showChannel);
        if (showChannel) {
          sliderSelectors_setFiltersEnabled (currentObj.selectors_array, "ColorSelector", currentObj.channelColumn);
          currentObj.setColorFilterRadios(currentObj.channelColumn);
          currentObj.replaceColumn = currentObj.channelColumn;
        } else {
          sliderSelectors_setFiltersEnabled (currentObj.selectors_array, "ColorSelector", "E");
          currentObj.setColorFilterRadios("E");
          currentObj.replaceColumn = "E";
        }
        break;
      }
    }
    sliderSelectors_setFilters(filters, currentObj.selectors_array);
    currentObj.filters = filters;
  }

  this.getFilters = function () {
    return currentObj.filters;
  }

  this.onSelectorValuesChanged = function () {
    currentObj.refreshFloatingBtn.show();
  }

  this.onColorFilterTypeChanged = function (columnName) {
    var selectorsContainer = currentObj.$html.find(".colorSelectorsContainer");
    selectorsContainer.children().hide();

    if (columnName == "E") {
      if (currentObj.tabPanel.projectConfig.rmfFilename == "") {

        //Show upload RMF file
        var rmfFileDiv = $('<div class="rmfFileDiv"></div>');
        if (rmfFileDiv.children().length == 0) {
          var rmfBtn = $('<button class="btn btn-warning btnRmf"> Upload RMF file </button>');
          rmfBtn.click(function () {
            currentObj.rmfFileSelector.showSelectFile();
          });
          rmfFileDiv.html('<p class="text-warning">RMF file is requiered for processing energy values:</p>');
          rmfFileDiv.append(rmfBtn);
          selectorsContainer.append(rmfFileDiv);
        }
        rmfFileDiv.show();
        gaTracker.sendEvent("LoadPage", "ShowRMFRequiered", currentObj.id);

      } else {
        //Show ENERGY color selectors
        sliderSelectors_setFiltersEnabled (currentObj.selectors_array, "ColorSelector", "E");

        //Sets energy values to Energy Selectors from Pha selector values
        var e_Selectors = sliderSelectors_getSelectors(currentObj.selectors_array, "ColorSelector", "E");
        var pha_Selectors = sliderSelectors_getSelectors(currentObj.selectors_array, "ColorSelector", currentObj.channelColumn);
        for (i in pha_Selectors) {
          var phaSelector = pha_Selectors[i];
          for (i in e_Selectors) {
            var eSelector = e_Selectors[i];
            if (eSelector.filterData.column == phaSelector.filterData.column){
              var eFromValue = currentObj.tabPanel.projectConfig.getEnergyForChannel(phaSelector.fromValue);
              var eToValue = currentObj.tabPanel.projectConfig.getEnergyForChannel(phaSelector.toValue);
              if (eFromValue > -1 && eToValue > -1){
                eSelector.setValues(eFromValue, eToValue);
              }
              break;
            }
          }
        }

        selectorsContainer.find(".colorSelectors_E").show();
        currentObj.replaceColumn = "E";
        currentObj.onSelectorValuesChanged();
      }
    } else {
      //Show Channel color selectors
      sliderSelectors_setFiltersEnabled (currentObj.selectors_array, "ColorSelector", currentObj.channelColumn);

      //Sets values to Channel Selectors from Energy selector values
      var e_Selectors = sliderSelectors_getSelectors(currentObj.selectors_array, "ColorSelector", "E");
      var pha_Selectors = sliderSelectors_getSelectors(currentObj.selectors_array, "ColorSelector", currentObj.channelColumn);
      for (i in pha_Selectors) {
        var phaSelector = pha_Selectors[i];
        for (i in e_Selectors) {
          var eSelector = e_Selectors[i];
          if (eSelector.filterData.column == phaSelector.filterData.column){
            var phaFromValue = currentObj.tabPanel.projectConfig.getChannelFromEnergy(eSelector.fromValue);
            var phaToValue = currentObj.tabPanel.projectConfig.getChannelFromEnergy(eSelector.toValue);
            if (phaFromValue > -1 && phaToValue > -1){
              phaSelector.setValues(phaFromValue, phaToValue);
            }
            break;
          }
        }
      }

      selectorsContainer.find(".colorSelectors_" + currentObj.channelColumn).show();
      currentObj.replaceColumn = currentObj.channelColumn;
      currentObj.onSelectorValuesChanged();
    }
  }

  this.getReplaceColumn = function () {
    return currentObj.replaceColumn;
  }

  this.refresh = function () {
    currentObj.refreshFloatingBtn.hide();
    currentObj.filters = sliderSelectors_getFilters(currentObj.selectors_array);
    getTabForSelector(currentObj.id).onFiltersChanged(currentObj.filters);
  }

  this.containsId = function (id) {

    if (this.id == id) {
        return true;
    }

    if (!isNull(this.binSelector) && this.binSelector.id == id) {
        return true;
    }

    for (i in this.selectors_array) {
      if (!isNull(this.selectors_array[id])) {
          return true;
      }
    }

    for (i in this.file_selectors_ids_array) {
      if (this.file_selectors_ids_array[i] == id) {
          return true;
      }
    }

    return false;
  }

  this.getFiltersAsAction = function (projectConfig) {
    return { type: "filters",
             actionData: $.extend(true, [], currentObj.filters),
             binSize: projectConfig.binSize,
             maxSegmentSize: projectConfig.maxSegmentSize };
  }

  this.saveFilters = function () {
    var projectConfig = getTabForSelector(currentObj.id).projectConfig;
    var filename = projectConfig.filename.replace(/\./g,'');
    saveToFile (filename + "_filters.flt", JSON.stringify(this.getFiltersAsAction(projectConfig)));
  }

  this.loadFilters = function () {
    showLoadFile (function(e, file) {
      try {
        if (!isNull(e)) {
          var action = JSON.parse(e.target.result);
          if (!isNull(action.type) && !isNull(action.actionData)){
            getTabForSelector(currentObj.id).historyManager.applyAction(action);
            return;
          }
        }

        //Else show error
        showError("File: " + file.name + " is not supported as filters");

      } catch (e) {
        showError("File is not supported as filters", e);
      }
    }, ".flt");
  }

  this.getConfig = function (projectConfig) {
    return this.getFiltersAsAction(projectConfig);
  }

  this.setConfig = function (projectConfig, callback) {

    log("setConfig for toolPanel " + this.id);

    var fileLoadList = [
        function(callback) {
            currentObj.setFilesOnFileSelector("SRC", projectConfig.filename, projectConfig.filenames, currentObj.onDatasetChangedFn, callback);
        },
        function(callback) {
            currentObj.setFilesOnFileSelector("BCK", projectConfig.bckFilename, projectConfig.bckFilenames, currentObj.onDatasetChangedFn, callback);
        },
        function(callback) {
            currentObj.setFilesOnFileSelector("GTI", projectConfig.gtiFilename, projectConfig.gtiFilenames, currentObj.onDatasetChangedFn, callback);
        },
        function(callback) {
            currentObj.setFilesOnFileSelector("RMF", projectConfig.rmfFilename, [], currentObj.onDatasetChangedFn, callback);
        }
    ];

    var lcSelectorKeys = ["LCA", "LCB", "LCC", "LCD", "LCA_BCK", "LCB_BCK", "LCC_BCK", "LCD_BCK"];
    var makeLcCallbackFunc = function(lcKey, filename) {
        return function(callback) {
          currentObj.setFilesOnFileSelector(lcKey, filename, [], currentObj.onLcDatasetChangedFn, callback);
        }
    };

    for (i in lcSelectorKeys) {
      var lcKey = lcSelectorKeys[i];
      var filename = projectConfig.selectorFilenames[lcKey];
      if (!isNull(filename) && filename != "") {
        fileLoadList.push(makeLcCallbackFunc(lcKey, filename));
      }
    };

    async.waterfall(fileLoadList, function (err, result) {
        if (!isNull(err)){
          log("setConfig on toolPanel " + currentObj.id + " error: " + err);
        } else {
          log("setConfig success for toolPanel " + currentObj.id);
        }

        callback(err);
    });
  }

  this.setFilesOnFileSelector = function (selectorKey, filename, filenames, changedFn, callback) {
    var fileSelector = this.getFileSelector(selectorKey);
    if (!isNull(fileSelector) && (filename != "")) {
      fileSelector.onUploadSuccess([filename]);
      filenames.splice(0, 0, filename);
      changedFn(filenames, selectorKey, callback);
    } else {
      callback();
    }
  }

  this.setAnalisysSections = function (sections) {
    if (sections.length > 0) {
      this.$html.find(".analyzeContainer").html("");
      for (i in sections) {
        this.addAnalisysSection(sections[i]);
      };
    }
  }

  this.addAnalisysSection = function (section) {
    var $section = $('<div class="Section HlSection Disabled ' + section.cssClass + '">' +
                      '<div class="switch-wrapper">' +
                      '  <div id="switch_' + section.cssClass + '_' + this.id + '" section="' + section.cssClass + '" class="switch-btn fa fa-square-o" aria-hidden="true"></div>' +
                      '</div>' +
                      '<h3>' + section.title + '</h3>' +
                      '<div class="sectionContainer">' +
                      '</div>' +
                    '</div>');

    $section.find(".sectionContainer").hide();
    $section.find(".switch-btn").click( function ( event ) {
      currentObj.toggleEnabledSection($(this).attr("section"));
    });

    if (!isNull(section.extraButtons)){
      for (i in section.extraButtons) {
        $section.find(".sectionContainer").append(section.extraButtons[i]);
      };
    }

    this.$html.find(".analyzeContainer").append($section);
  }

  this.addBulkAnalisysButton = function () {
    var $section = $('<div class="Section HlSection ulkAnalisysSection">' +
                      '<h3>Bulk Analisys <i class="fa fa-list" aria-hidden="true"></i></h3>' +
                      '<div class="sectionContainer"></div>' +
                    '</div>');
    $section.find("h3").click( function ( event ) {
      if (!isNull(currentObj.tabPanel)){
        showBulkAnalisysDialog(currentObj.tabPanel);
      }
    });
    this.$html.find(".analyzeContainer").append($section);
  }

  this.clearBulkAnalisysPlotResults = function () {
    this.$html.find(".BulkAnalisysSection").find(".sectionContainer").html("");
  }

  this.addBulkAnalisysPlotResults = function (plotId, plotTitle) {

    //Adds a plotBulkResults section for this plot bulk data
    var $sectionContainer = this.$html.find(".BulkAnalisysSection").find(".sectionContainer");
    var $plotBulkResults = $('<div class="plotBulkResults ' + plotId + ' ">' +
                              '<div class="switch-wrapper">' +
                              '  <div id="switch_' + plotId + '" plotId="' + plotId + '" class="switch-btn fa fa-check-square-o" aria-hidden="true"></div>' +
                              '</div>' +
                              '<h4>' + plotTitle + '</h4>' +
                              '<div class="plotFilenames"></div>' +
                            '</div>');
    $sectionContainer.append($plotBulkResults);

    //Show and hide plot filenames
    $plotBulkResults.find(".switch-btn").click(function ( event ) {
      var plotId = $(this).attr("plotId");
      var $plotsection = currentObj.$html.find(".BulkAnalisysSection").find("." + plotId);
      var $switchBtn = $plotsection.find(".switch-btn");
      this.setEnabledSectionCore($plotsection,
                                 $plotsection.find(".plotFilenames"),
                                 $switchBtn,
                                 !$switchBtn.hasClass("fa-check-square-o"));
    });

    return $plotBulkResults.find(".plotFilenames");
  }

  this.isSectionEnabled = function (sectionClass) {
    var $section = this.$html.find(".analyzeContainer").find("." + sectionClass);
    var $switchBtn = $section.find(".switch-btn");
    return $switchBtn.hasClass("fa-check-square-o");
  }

  this.toggleEnabledSection = function (sectionClass) {
    this.setEnabledSection(sectionClass, !this.isSectionEnabled(sectionClass));
  }

  this.setEnabledSection = function (sectionClass, enabled) {
    var $section = this.$html.find(".analyzeContainer").find("." + sectionClass);
    this.setEnabledSectionCore($section,
                               $section.find(".sectionContainer"),
                               $section.find(".switch-btn"),
                               enabled);
  }

  this.setEnabledSectionCore = function ($section, $sectionContainer, $switchBtn, enabled){
    setVisibility($sectionContainer, enabled);
    if (enabled) {
      $switchBtn.switchClass("fa-square-o", "fa-check-square-o");
      $section.removeClass("Disabled");
    } else {
      $switchBtn.switchClass("fa-check-square-o", "fa-square-o");
      $section.addClass("Disabled");
    }
  }

  this.setEnabledSectionCore = function ($section, $sectionContainer, $switchBtn, enabled){
    setVisibility($sectionContainer, enabled);
    if (enabled) {
      $switchBtn.switchClass("fa-square-o", "fa-check-square-o");
      $section.removeClass("Disabled");
    } else {
      $switchBtn.switchClass("fa-check-square-o", "fa-square-o");
      $section.addClass("Disabled");
    }
  }

  this.onPlotShown = function (plotId) {
    if (!isNull(this.tabPanel)) {
      var btnShow = this.tabPanel.$html.find(".sectionContainer").find("button[plotId='" + plotId + "']");
      btnShow.removeClass("plotHidden");
      btnShow.find("i").switchClass( "fa-eye-slash", "fa-eye");
    }
  }

  this.onPlotHidden = function (plotId) {
    if (!isNull(this.tabPanel)) {
      var btnShow = this.tabPanel.$html.find(".sectionContainer").find("button[plotId='" + plotId + "']");
      btnShow.addClass("plotHidden");
      btnShow.find("i").switchClass( "fa-eye", "fa-eye-slash");
      this.refreshPlotStylingControls();
    }
  }

  this.onPlotStyleClicked = function (plotId) {
    if (!isNull(this.tabPanel)) {
      this.tabPanel.setCurrentPanel("stylePanel");
      this.$html.find(".plotSelector").val(plotId);
      this.onPlotStyleSelected(plotId);
    }
  }

  this.onPlotStylesChanged = function (plotId) {
    if (!isNull(this.tabPanel)
        && (this.tabPanel.getCurrentPanel() == "stylePanel")
        && (this.$html.find(".plotSelector").val() == plotId)) {
      setTimeout(function (){currentObj.onPlotStyleSelected(plotId);}, 1000);
    }
  }

  this.onPlotStyleSelected = function (plotId) {
    var $plotStyleContainer = this.$html.find(".plotStyleContainer");
    $plotStyleContainer.html("");
    if (plotId != "") {
      if (plotId != "all") {

        if (!isNull(this.tabPanel)) {
          var plot = this.tabPanel.outputPanel.getPlotById(plotId);
          if (!isNull(plot)) {
            $plotStyleContainer.append(plot.getStyleJQElem());
          } else {
            logErr("Can't find plot for PlotId: " + plotId);
          }
        } else {
          logErr("Can't find tabPanel for ToolPanel: " + currentObj.id);
        }

      } else {
         //Show all/generic plot style controls
         $plotStyleContainer.append(currentObj.getAllPlotsStyleJQElem());
      }
    }
  }

  this.refreshPlotStylingControls = function () {
    var $mainPlotStyleContainer = this.$html.find(".mainPlotStyleContainer");
    var $analyzeContainer = this.$html.find(".analyzeContainer")
    $mainPlotStyleContainer.html("");

    var $plotSelectorContainer = $('<div class="ui-widget plotSelectorContainer marginTop">' +
                                      '<label>Select a plot: </label>' +
                                      '<select class="plotSelector width100">' +
                                        '<option value="all">All plots</option>' +
                                      '</select>' +
                                    '</div>');

    var $plotStyleContainer = $('<div class="plotStyleContainer"></div>');

    var $plotSelector = $plotSelectorContainer.find(".plotSelector");
    if (!isNull(this.tabPanel)){
      for (var i = 0; i < this.tabPanel.outputPanel.plots.length; i++){
        var plot = this.tabPanel.outputPanel.plots[i];
        if (plot.isVisible){
          $plotSelector.append($('<option value="' + plot.id + '">' +
                                     plot.plotConfig.styles.title +
                                 '</option>'));
        }
      }
    }

    $plotSelector.on('change', function() {
       currentObj.onPlotStyleSelected($(this).val());
     });

    $mainPlotStyleContainer.append($plotSelectorContainer);
    $mainPlotStyleContainer.append($plotStyleContainer);
    this.onPlotStyleSelected("all");
  }

  this.getAllPlotsStyleJQElem = function () {
      var plotDefaultConfig = currentObj.getDefaultPlotlyConfig();
      var $style = $('<div class="plotStyle marginTop">' +
                      '<div class="floatingContainer">' +
                        '<button class="btn button btnClear" data-toggle="tooltip" title="Clear style"><i class="fa fa-eraser" aria-hidden="true"></i></button>' +
                        '<button class="btn button btnLoad" data-toggle="tooltip" title="Load style"><i class="fa fa-folder-open-o" aria-hidden="true"></i></button>' +
                        '<button class="btn button btnSave" data-toggle="tooltip" title="Save style"><i class="fa fa-floppy-o" aria-hidden="true"></i></button>' +
                      '</div>' +
                    '</div>');

      $style.find(".btnClear").click(function () {
        if (!isNull(currentObj.tabPanel)){
            currentObj.tabPanel.plotDefaultConfig = null;
            currentObj.onPlotStyleSelected("all");
            currentObj.redrawPlots();
            gaTracker.sendEvent("LoadPage", "ClearGeneralStyles", currentObj.id);
        }
      });

      $style.find(".btnLoad").click(function () {
        if (!isNull(currentObj.tabPanel)){
            currentObj.tabPanel.loadDefaultPlotlyConfig(function () {
              currentObj.onPlotStyleSelected("all");
              currentObj.redrawPlots();
              gaTracker.sendEvent("LoadPage", "LoadGeneralStyles", currentObj.id);
            });
        }
      });

      $style.find(".btnSave").click(function () {
        if (!isNull(currentObj.tabPanel)){
            currentObj.tabPanel.saveDefaultPlotlyConfig();
            gaTracker.sendEvent("LoadPage", "SaveGeneralStyles", currentObj.id);
        }
      });

      //Add font selector
      var $fontSelectorContainer = $('<div class="ui-widget fontSelectorContainer marginTop">' +
                                        '<label style="font-weight: 400;">Title and axis font: </label>' +
                                        '<select class="fontSelector width100"></select>' +
                                      '</div>');
      var $fontSelector = $fontSelectorContainer.find(".fontSelector");
      for (i = 0; i < plotDefaultConfig.SUPPORTED_FONTS.length; i++) {
        var font = plotDefaultConfig.SUPPORTED_FONTS[i];
        $fontSelector.append($('<option value="' + font + '">' +  font + '</option>'));
       };
      $fontSelector.val(plotDefaultConfig.DEFAULT_TITLE_FONT.family);
      $fontSelector.on('change', function() {
        currentObj.getDefaultPlotlyConfig().DEFAULT_TITLE_FONT.family = $(this).val();
        currentObj.redrawPlots();
      });
      $style.append($fontSelectorContainer);
      $style.append($('<label class="clear marginTop" style="font-weight: 400;">Default colors:</label>'));
      $style.append(getColorPicker("colorPickerFontColor_" + this.id, plotDefaultConfig.DEFAULT_TITLE_FONT.color, function (color, id) {
        var plotDefaultConfig = currentObj.getDefaultPlotlyConfig();
        plotDefaultConfig.DEFAULT_TITLE_FONT.color = color;
        currentObj.redrawPlots();
      }));
      var fontSize = getInlineRangeBox ("fontSize_" + this.id, "inputFontSize float",
                                  "Font color & size", plotDefaultConfig.DEFAULT_TITLE_FONT.size, 5, 25,
                                  function(value, input) {
                                    var plotDefaultConfig = currentObj.getDefaultPlotlyConfig();
                                    plotDefaultConfig.DEFAULT_TITLE_FONT.size = value;
                                    currentObj.redrawPlots();
                                  });
      fontSize.addClass("width100");
      $style.append(fontSize);

      //Adds the default plot color selector
      $style.append($('<p class="clear allPlots marginTop">Data color</p>'));
      $style.append(getColorPicker("colorPickerDC_" + this.id, plotDefaultConfig.DEFAULT_PLOT_COLOR, function (color, id) {
        currentObj.getDefaultPlotlyConfig().DEFAULT_PLOT_COLOR = color;
        currentObj.redrawPlots();
      }));

      //Adds the error color selector
      $style.append(getColorPicker("colorPickerE_" + this.id, "#" + RGBAStrToHex(plotDefaultConfig.ERROR_BAR_COLOR), function (color, id) {
        var plotDefaultConfig = currentObj.getDefaultPlotlyConfig();
        var rgba = RGBAStrToRGBA(plotDefaultConfig.ERROR_BAR_COLOR);
        plotDefaultConfig.ERROR_BAR_COLOR = HexAndAlphaToRGBAStr (color, rgba.a);
        currentObj.redrawPlots();
      }));

      //Adds the error opacity
      var errorOpacity = getInlineRangeBox ("EOpacity_" + this.id, "inputErrorOpacity float",
                                  "Error color & opacity", RGBAStrToRGBA(plotDefaultConfig.ERROR_BAR_COLOR).a, 0, 1,
                                  function(value, input) {
                                    var plotDefaultConfig = currentObj.getDefaultPlotlyConfig();
                                    var rgba = RGBAStrToRGBA(plotDefaultConfig.ERROR_BAR_COLOR);
                                    plotDefaultConfig.ERROR_BAR_COLOR = HexAndAlphaToRGBAStr (RGBToHex(rgba), value);
                                    currentObj.redrawPlots();
                                  });
      errorOpacity.addClass("width100");
      $style.append(errorOpacity);

      //Adds the error color selector
      $style.append(getColorPicker("colorPickerWTI_" + this.id, plotDefaultConfig.WTI_FILLCOLOR, function (color, id) {
        var plotDefaultConfig = currentObj.getDefaultPlotlyConfig();
        plotDefaultConfig.WTI_FILLCOLOR = color;
        currentObj.redrawPlots();
      }));

      //Adds the error opacity
      var errorOpacity = getInlineRangeBox ("WTIOpacity_" + this.id, "inputWtiOpacity float",
                                  "WTI color & opacity", plotDefaultConfig.WTI_OPACITY, 0, 1,
                                  function(value, input) {
                                    var plotDefaultConfig = currentObj.getDefaultPlotlyConfig();
                                    plotDefaultConfig.WTI_OPACITY = value;
                                    currentObj.redrawPlots();
                                  });
      errorOpacity.addClass("width100");
      $style.append(errorOpacity);

      //Adds the default plot extra data color selector
      $style.append($('<p class="clear allPlots">External data color</p>'));
      $style.append(getColorPicker("colorPickerEDC_" + this.id, plotDefaultConfig.EXTRA_DATA_COLOR, function (color, id) {
        plotDefaultConfig.EXTRA_DATA_COLOR = color;
        currentObj.redrawPlots();
      }));

      //Adds the line width
      $style.append($('<label class="clear marginTop" style="font-weight: 400;">Default lines and markers:</label>'));
      var lineWidth = getInlineRangeBox ("lineWidth_" + this.id, "inputLineWidth",
                                  "Line width",
                                  plotDefaultConfig.DEFAULT_LINE_WIDTH.default,
                                  plotDefaultConfig.DEFAULT_LINE_WIDTH.min,
                                  plotDefaultConfig.DEFAULT_LINE_WIDTH.max,
                                  function(value, input) {
                                    plotDefaultConfig.DEFAULT_LINE_WIDTH.default = value;
                                    currentObj.redrawPlots();
                                  });
      lineWidth.addClass("allPlots");
      $style.append(lineWidth);

      //Adds the marker size
      var markerSize = getInlineRangeBox ("markerSize_" + this.id, "inputMarkerSize",
                                  "Marker size",
                                  plotDefaultConfig.DEFAULT_MARKER_SIZE.default,
                                  plotDefaultConfig.DEFAULT_MARKER_SIZE.min,
                                  plotDefaultConfig.DEFAULT_MARKER_SIZE.max,
                                  function(value, input) {
                                    plotDefaultConfig.DEFAULT_MARKER_SIZE.default = value;
                                    currentObj.redrawPlots();
                                  });
      markerSize.addClass("allPlots");
      $style.append(markerSize);

      //Adds the marker opacity
      var markerOpacity = getInlineRangeBox ("markerOpacity_" + this.id, "inputMarkerOpacity float",
                                  "Marker opacity", plotDefaultConfig.DEFAULT_MARKER_OPACITY, 0, 1,
                                  function(value, input) {
                                    plotDefaultConfig.DEFAULT_MARKER_OPACITY = value;
                                    currentObj.redrawPlots();
                                  });
      markerOpacity.addClass("allPlots");
      $style.append(markerOpacity);

      //Adds the marker type selector
      $style.append(getRadioControl("markerType_" + this.id,
                                    "Marker type",
                                    "markerType",
                                    [
                                      { id:"circle", label:"circle", value:"circle" },
                                      { id:"circle-open", label:"circle-open", value:"circle-open" },
                                      { id:"square", label:"square", value:"square" },
                                      { id:"square-open", label:"square-open", value:"square-open" },
                                      { id:"diamond", label:"diamond", value:"diamond" },
                                      { id:"diamond-open", label:"diamond-open", value:"diamond-open" },
                                      { id:"cross", label:"cross", value:"cross" },
                                      { id:"x", label:"x", value:"x" }
                                    ],
                                    plotDefaultConfig.DEFAULT_MARKER_TYPE,
                                    function(value, id) {
                                      plotDefaultConfig.DEFAULT_MARKER_TYPE = value;
                                      currentObj.redrawPlots();
                                    },
                                    "smallTextStyle"));

      return $style;
  }

  this.redrawPlots = function (){
    if (!isNull(this.tabPanel)){
      this.tabPanel.outputPanel.redrawAllDiffered();
    }
  }

  this.getDefaultPlotlyConfig = function (){
    if (!isNull(this.tabPanel)){
      return this.tabPanel.getDefaultPlotlyConfig();
    } else {
      return $.extend(true, {}, CONFIG.PLOT_CONFIG);
    }
  }


  //Normal file selectors, SRC is valid on both events files and lightcurves

  this.createSngOrMultiFileSelector();

  this.srcFileSelector = new fileSelector("theSrcFileSelector_" + this.id, "Load File:", "SRC", service.upload_form_data, this.onDatasetChangedFn);
  this.addFileSelector(this.srcFileSelector);

  this.bckFileSelector = new fileSelector("theBckFileSelector_" + this.id, "Background Event File:", "BCK", service.upload_form_data, this.onDatasetChangedFn);
  this.addFileSelector(this.bckFileSelector);
  this.bckFileSelector.hide();

  this.gtiFileSelector = new fileSelector("theGtiFileSelector_" + this.id, "GTI File:", "GTI", service.upload_form_data, this.onDatasetChangedFn);
  this.addFileSelector(this.gtiFileSelector);
  this.gtiFileSelector.hide();

  this.rmfFileSelector = new fileSelector("theRmfFileSelector_" + this.id, "RMF File:", "RMF", service.upload_form_data, this.onDatasetChangedFn);
  this.addFileSelector(this.rmfFileSelector);
  this.rmfFileSelector.hide();

  //Lightcurve file selectors
  this.lcAFileSelector = new fileSelector("lcAFileSelector_" + this.id, "Light curve in energy range A:", "LCA", service.upload_form_data, this.onLcDatasetChangedFn);
  this.addFileSelector(this.lcAFileSelector);
  this.lcAFileSelector.hide();

  this.lcBFileSelector = new fileSelector("lcBFileSelector_" + this.id, "Light curve in energy range B:", "LCB", service.upload_form_data, this.onLcDatasetChangedFn);
  this.addFileSelector(this.lcBFileSelector);
  this.lcBFileSelector.hide();

  this.lcCFileSelector = new fileSelector("lcCFileSelector_" + this.id, "Light curve in energy range C:", "LCC", service.upload_form_data, this.onLcDatasetChangedFn);
  this.addFileSelector(this.lcCFileSelector);
  this.lcCFileSelector.hide();

  this.lcDFileSelector = new fileSelector("lcDFileSelector_" + this.id, "Light curve in energy range D:", "LCD", service.upload_form_data, this.onLcDatasetChangedFn);
  this.addFileSelector(this.lcDFileSelector);
  this.lcDFileSelector.hide();

  //Adds lightcurves background selectors
  this.lcBckFileSelector = new fileSelector("lcBckFileSelector_" + this.id, "Total background light curve:", "BCK", service.upload_form_data, this.onDatasetChangedFn);
  this.lcBckFileSelector.hide();
  this.addFileSelector(this.lcBckFileSelector);

  this.lcABckFileSelector = new fileSelector("lcABckFileSelector_" + this.id, "Background LC energy range A:", "LCA_BCK", service.upload_form_data, this.onLcDatasetChangedFn);
  this.lcABckFileSelector.hide();
  this.addFileSelector(this.lcABckFileSelector);

  this.lcBBckFileSelector = new fileSelector("lcBBckFileSelector_" + this.id, "Background LC energy range B:", "LCB_BCK", service.upload_form_data, this.onLcDatasetChangedFn);
  this.lcBBckFileSelector.hide();
  this.addFileSelector(this.lcBBckFileSelector);

  this.lcCBckFileSelector = new fileSelector("lcCBckFileSelector_" + this.id, "Background LC energy range C:", "LCC_BCK", service.upload_form_data, this.onLcDatasetChangedFn);
  this.lcCBckFileSelector.hide();
  this.addFileSelector(this.lcCBckFileSelector);

  this.lcDBckFileSelector = new fileSelector("lcDBckFileSelector_" + this.id, "Background LC energy range D:", "LCD_BCK", service.upload_form_data, this.onLcDatasetChangedFn);
  this.lcDBckFileSelector.hide();
  this.addFileSelector(this.lcDBckFileSelector);

  //Filter tab buttons
  this.clearBtn.click(function () {
      currentObj.historyManager.resetHistory();
      gaTracker.sendEvent("LoadPage", "resetHistory", currentObj.id);
  });

  this.undoBtn.click(function () {
      currentObj.historyManager.undoHistory();
      gaTracker.sendEvent("LoadPage", "undoHistory", currentObj.id);
  });

  this.loadBtn.click(function () {
      currentObj.loadFilters();
      gaTracker.sendEvent("LoadPage", "loadFilters", currentObj.id);
  });

  this.saveBtn.click(function () {
      currentObj.saveFilters();
      gaTracker.sendEvent("LoadPage", "saveFilters", currentObj.id);
  });

  this.refreshBtn.click(function () {
      currentObj.refresh();
  });

  this.refreshFloatingBtn.hide();
  this.refreshFloatingBtn.click(function () {
      currentObj.refresh();
  });

  this.dragDropBtn.click(function () {
      currentObj.dragDropBtn.toggleClass("btn-success");
      currentObj.dragDropEnabled = currentObj.dragDropBtn.hasClass("btn-success");
      currentObj.onDragDropChanged(currentObj.dragDropEnabled);
      gaTracker.sendEvent("LoadPage", "reorganizePlots", currentObj.id);
  });

  log("ToolPanel ready! classSelector: " + this.classSelector);
  return this;
}
