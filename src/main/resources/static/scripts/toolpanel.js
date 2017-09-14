
function ToolPanel (id,
                    classSelector,
                    container,
                    service,
                    onDatasetChangedFn,
                    onLcDatasetChangedFn,
                    onFiltersChangedFn,
                    historyManager,
                    onDragDropChangedFn)
{

  var currentObj = this;

  this.id = id;
  this.classSelector = classSelector;
  this.$html = cloneHtmlElement(id, classSelector);
  container.html(this.$html);
  this.$html.show();
  this.filters = [];
  this.loadFileType = "Single"; // Supported: Single, Concatenated, Independent

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
  this.replaceColumn = "PHA";

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
  }

  this.createSngOrMultiFileSelector = function () {
    // Creates Single file or Multifile selection radio buttons
    this.sngOrMultiFileSelector = $('<div class="SngOrMultiFileSelector">' +
                                    '<h3>Choose single or multiple files load:</h3>' +
                                    '<fieldset>' +
                                      '<label for="' + this.id + '_SngFile">Single file</label>' +
                                      '<input type="radio" name="' + this.id + '_SngOrMultiFile" id="' + this.id + '_SngFile" value="Single" ' + getCheckedState(this.loadFileType == "Single") + '>' +
                                      '<label for="' + this.id + '_MulFile">Multiple files</label>' +
                                      '<input type="radio" name="' + this.id + '_SngOrMultiFile" id="' + this.id + '_MulFile" value="Multi" ' + getCheckedState(this.loadFileType != "Single") + '>' +
                                    '</fieldset>' +
                                  '</div>');

    this.$html.find(".fileSelectorsContainer").append(this.sngOrMultiFileSelector);
    var $loadTypeRadios = this.sngOrMultiFileSelector.find("input[type=radio][name=" + this.id + "_SngOrMultiFile]")
    $loadTypeRadios.checkboxradio();
    this.sngOrMultiFileSelector.find("fieldset").controlgroup();
    $loadTypeRadios.change(function() {
      currentObj.updateLoadFileType();
      var multiFileEnabled = currentObj.loadFileType != "Single";
      setVisibility(currentObj.conOrIndFileSelector, multiFileEnabled);
      for (idx in currentObj.file_selectors_array) {
        var fileSelector = currentObj.file_selectors_array[idx];
        fileSelector.setMultiFileEnabled(multiFileEnabled
                                         && (fileSelector.selectorKey != "RMF")
                                         && (!fileSelector.selectorKey.startsWith("LC")));
      }
    });

    // Creates Concatenated files or Independent selection radio buttons
    this.conOrIndFileSelector = $('<div class="ConOrIndFileSelector">' +
                                    '<h3>Choose concatenated or independent files load:</h3>' +
                                    '<fieldset>' +
                                      '<label for="' + this.id + '_ConFile">Concatenated</label>' +
                                      '<input type="radio" name="' + this.id + '_ConOrIndFile" id="' + this.id + '_ConFile" value="Concatenated" ' + getCheckedState((this.loadFileType == "Single") || (this.loadFileType == "Concatenated")) + '>' +
                                      '<label for="' + this.id + '_IndFile">Independent</label>' +
                                      '<input type="radio" name="' + this.id + '_ConOrIndFile" id="' + this.id + '_IndFile" value="Independent" ' + getCheckedState(this.loadFileType == "Concatenated") + '>' +
                                    '</fieldset>' +
                                  '</div>');

    setVisibility(this.conOrIndFileSelector, this.loadFileType == "Multi");
    this.$html.find(".fileSelectorsContainer").append(this.conOrIndFileSelector);
    var $loadType2Radios = this.conOrIndFileSelector.find("input[type=radio][name=" + this.id + "_ConOrIndFile]")
    $loadType2Radios.checkboxradio();
    this.conOrIndFileSelector.find("fieldset").controlgroup();
    $loadType2Radios.change(function() {
      currentObj.updateLoadFileType();
    });
  }

  this.updateLoadFileType = function () {
    if (this.sngOrMultiFileSelector.find("input").filter('[value=Single]').prop('checked')) {
      this.loadFileType = "Single";
    } else if (this.conOrIndFileSelector.find("input").filter('[value=Concatenated]').prop('checked')) {
      this.loadFileType = "Concatenated";
    } else {
      this.loadFileType = "Independent";
    }
  }

  this.removeSngOrMultiFileSelector = function () {
    this.sngOrMultiFileSelector.remove();
    this.conOrIndFileSelector.remove();
  }

  this.onTimeRangeChanged = function (timeRange) {
    if (CONFIG.AUTO_BINSIZE && !isNull(this.binSelector)){
      var tab = getTabForSelector(this.id);
      if (!isNull(tab)){
        var minValue = Math.max(timeRange / CONFIG.MAX_PLOT_POINTS, tab.projectConfig.minBinSize);
        var maxValue = Math.max(Math.min(timeRange / CONFIG.MIN_PLOT_POINTS, tab.projectConfig.maxBinSize), minValue * CONFIG.MIN_PLOT_POINTS);
        this.binSelector.setMinMaxValues(minValue, maxValue);
      }
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

      //Sets RMF fileSelector message depending on PHA column
      var rmfMessage = "";
      if (!projectConfig.schema.hasColumn("PHA")){
          //PHA Column doesn't exist, show we can't apply RMF file
          rmfMessage = "PHA column not found in SRC file";
      } else if (projectConfig.schema.getTable()["PHA"].min_value >= projectConfig.schema.getTable()["PHA"].max_value){
          //PHA Column is empty, show we can't apply RMF file
          rmfMessage = "PHA column is empty in SRC file";
      }

      if (rmfMessage != ""){
        //If hasen't PHA column then remove PI from excludedFilters
        excludedFilters = excludedFilters.filter(function(column) { return column != "PI"; });
      }
      this.rmfFileSelector.disable(rmfMessage);

      //Caluculates intial, max, min and step values for slider with time ranges
      var binSelectorConfig = getBinSelectorConfig(projectConfig);

      projectConfig.binSize = binSelectorConfig.binSize;

      this.binSelector = new BinSelector(this.id + "_binSelector",
                                        "BIN SIZE (" + projectConfig.timeUnit  + "):",
                                        "From",
                                        binSelectorConfig.minBinSize,
                                        binSelectorConfig.maxBinSize,
                                        binSelectorConfig.step,
                                        binSelectorConfig.binSize,
                                        this.onSelectorValuesChanged,
                                        null, CONFIG.MAX_TIME_RESOLUTION_DECIMALS);

      this.$html.find(".selectorsContainer").append(this.binSelector.$html);

    } else if (projectConfig.schema.isLightCurveFile()){

      //Prepares file selectors for lightcurve
      this.showLcSelectors();
      this.lcBckFileSelector.showInfoText((projectConfig.backgroundSubstracted ? "Background already substracted" : ""), CONFIG.DENY_BCK_IF_SUBS);

      //Sets fixed binSize panel
      var binDiv = $('<div class="sliderSelector binLabel">' +
                      '<h3>BIN SIZE (' + projectConfig.timeUnit  + '): ' + projectConfig.binSize + '</h3>' +
                    '</div>');
      this.$html.find(".selectorsContainer").append(binDiv);
    }

    var pha_column = null;

    //Adds the rest of selectors from dataset columns
    for (tableName in projectConfig.schema.contents) {
      if (tableName != "GTI") {
        var table = projectConfig.schema.contents[tableName];

        for (columnName in table) {
          var column = table[columnName];
          if (!excludedFilters.includes(columnName) && column.min_value < column.max_value) {

            var filterData = { table:tableName, column:columnName };
            var columnTitle = columnName + ":";
            if (columnName == "TIME") {
               columnTitle = "TIME (" + projectConfig.timeUnit  + "):";
            }

            var selector = new sliderSelector(this.id + "_" + columnName,
                                              columnTitle,
                                              filterData,
                                              "From", "To",
                                              column.min_value, column.max_value,
                                              this.onSelectorValuesChanged,
                                              this.selectors_array,
                                              null, CONFIG.MAX_TIME_RESOLUTION_DECIMALS);
            this.$html.find(".selectorsContainer").append(selector.$html);

            if ((columnName == "TIME")
                && (!CONFIG.AUTO_BINSIZE || projectConfig.schema.isLightCurveFile())
                && projectConfig.isMaxTimeRangeRatioFixed()) {

                  //If full events were cropped to CONFIG.MAX_PLOT_POINTS
                  selector.setMaxRange(projectConfig.getMaxTimeRange());
                  selector.setEnabled (true);
            }

            if (tableName == "EVENTS" && columnName == "PHA") {
              pha_column = column;
              selector.precision = 0;
            }
          }
        }

        this.buttonsContainer.removeClass("hidden");
        this.buttonsContainer.fadeIn();
        this.analyzeContainer.removeClass("hidden");
        this.styleContainer.removeClass("hidden");
      }
    }

    if (pha_column != null){

      // Creates colors filter type (PHA by default or ENERGY with RMF file upload requisite)
      this.colorFilterTypeRadios = $('<div class="colorFilterType">' +
                                      '<h3>Energy range filter type:</h3>' +
                                      '<fieldset>' +
                                        '<label for="' + this.id + '_PHA">Channel</label>' +
                                        '<input type="radio" name="' + this.id + '_ColorFilterType" id="' + this.id + '_PHA" value="PHA" checked="checked">' +
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
      });

      //Adds color selectors, PHA filters
      this.createColorSelectors (pha_column);
    }

    //Sets initial filters to ToolPanel
    currentObj.filters = sliderSelectors_getFilters(currentObj.selectors_array);
  }

  this.createColorSelectors = function (column) {
    var selectorNames = ["A", "B", "C", "D"];
    var increment = (column.max_value - column.min_value) * (1 / selectorNames.length);
    var container = $("<div class='colorSelectors_" + column.id + "'></div>");

    for (i in selectorNames) {
      var selectorName = selectorNames[i];
      var selectorKey = "Color_" + selectorName;
      var filterData = { table:"EVENTS", column:selectorKey, source:"ColorSelector", replaceColumn: column.id };
      var selector = new sliderSelector(this.id + "_selector_" + selectorKey + "_" + column.id,
                                        ((column.id == "PHA") ? "Channel" : "Energy") + " range " + selectorName + ":",
                                        filterData,
                                        "From", "To",
                                        column.min_value, column.max_value,
                                        this.onSelectorValuesChanged,
                                        this.selectors_array);
      var min_value = column.min_value + (increment * i);
      var max_value = min_value + increment;
      if (column.id == "PHA") {
        selector.precision = 0;
      } else {
        selector.setFixedStep(CONFIG.ENERGY_FILTER_STEP);
      }
      selector.setValues (min_value, max_value);
      selector.setEnabled (true);
      container.append(selector.$html);
    }

    this.$html.find(".colorSelectorsContainer").append(container);
    this.$html.find(".colorSelectorsContainer").removeClass("hidden");
  }

  this.onRmfDatasetUploaded = function ( schema ) {
    if (schema.isEventsFile()) {
      var column = schema.getTable()["E"];
      if (!isNull(column)){
        //Adds Energy general filter
        var selector = new sliderSelector(this.id + "_Energy",
                                          "Energy (keV):",
                                          { table:"EVENTS", column:"E" },
                                          "From", "To",
                                          column.min_value, column.max_value,
                                          this.onSelectorValuesChanged,
                                          this.selectors_array);
        selector.setFixedStep(CONFIG.ENERGY_FILTER_STEP);
        selector.$html.insertAfter("." + this.id + "_TIME");

        //Prepares Energy color filters
        this.createColorSelectors(column);
        this.onColorFilterTypeChanged("E");
        this.setColorFilterRadios("E");
      }
    }
  }

  this.isCountRateSliderCreated = function ( visible ) {
    return !isNull(getTabForSelector(this.id + "_Rate"));
  }

  this.createCountRateSlider = function ( minRate, maxRate ) {
    var rateSelector = new sliderSelector(this.id + "_Rate",
                                      "COUNT RATE (c/s):",
                                      { table:"EVENTS", column:"RATE" },
                                      "From", "To",
                                      minRate, maxRate,
                                      this.onSelectorValuesChanged,
                                      this.selectors_array);
    rateSelector.$html.insertAfter("." + this.id + "_TIME");
  }

  this.updateCountRateSlider = function ( minRate, maxRate ) {
    var rateSliderId = this.id + "_Rate";
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

  this.setColorFilterRadios = function (column) {
    var colorFilterTypeRadios = this.$html.find(".colorFilterType").find("input");
    colorFilterTypeRadios.filter('[value=PHA]').prop('checked', column == "PHA").checkboxradio('refresh');
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
        var tab = getTabForSelector(currentObj.id);
        var selectorsContainer = currentObj.$html.find(".colorSelectorsContainer");
        var showPHA = (tab.projectConfig.rmfFilename == "") || (filters[f].replaceColumn == "PHA");
        setVisibility(selectorsContainer.find(".colorSelectors_PHA"), showPHA);
        setVisibility(selectorsContainer.find(".colorSelectors_E"), !showPHA);
        if (showPHA) {
          sliderSelectors_setFiltersEnabled (currentObj.selectors_array, "ColorSelector", "PHA");
          currentObj.setColorFilterRadios("PHA");
          currentObj.replaceColumn = "PHA";
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
    var tab = getTabForSelector(currentObj.id);
    var selectorsContainer = currentObj.$html.find(".colorSelectorsContainer");
    selectorsContainer.children().hide();

    if (columnName == "E") {
      if (tab.projectConfig.rmfFilename == "") {

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

      } else {
        //Show ENERGY color selectors
        sliderSelectors_setFiltersEnabled (currentObj.selectors_array, "ColorSelector", "E");

        //Sets energy values to Energy Selectors from Pha selector values
        var e_Selectors = sliderSelectors_getSelectors(currentObj.selectors_array, "ColorSelector", "E");
        var pha_Selectors = sliderSelectors_getSelectors(currentObj.selectors_array, "ColorSelector", "PHA");
        for (i in pha_Selectors) {
          var phaSelector = pha_Selectors[i];
          for (i in e_Selectors) {
            var eSelector = e_Selectors[i];
            if (eSelector.filterData.column == phaSelector.filterData.column){
              var eFromValue = tab.projectConfig.getEnergyForChannel(phaSelector.fromValue);
              var eToValue = tab.projectConfig.getEnergyForChannel(phaSelector.toValue);
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
      //Show PHA color selectors
      sliderSelectors_setFiltersEnabled (currentObj.selectors_array, "ColorSelector", "PHA");

      //Sets pha values to PHA Selectors from Energy selector values
      var e_Selectors = sliderSelectors_getSelectors(currentObj.selectors_array, "ColorSelector", "E");
      var pha_Selectors = sliderSelectors_getSelectors(currentObj.selectors_array, "ColorSelector", "PHA");
      for (i in pha_Selectors) {
        var phaSelector = pha_Selectors[i];
        for (i in e_Selectors) {
          var eSelector = e_Selectors[i];
          if (eSelector.filterData.column == phaSelector.filterData.column){
            var phaFromValue = tab.projectConfig.getChannelFromEnergy(eSelector.fromValue);
            var phaToValue = tab.projectConfig.getChannelFromEnergy(eSelector.toValue);
            if (phaFromValue > -1 && phaToValue > -1){
              phaSelector.setValues(phaFromValue, phaToValue);
            }
            break;
          }
        }
      }

      selectorsContainer.find(".colorSelectors_PHA").show();
      currentObj.replaceColumn = "PHA";
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
    showLoadFile (function(e) {
      try {
        var action = JSON.parse(e.target.result);
        if (!isNull(action.type) && !isNull(action.actionData)){
          getTabForSelector(currentObj.id).historyManager.applyAction(action);
        } else {
          showError("File is not supported as filters");
        }
      } catch (e) {
        showError("File is not supported as filters", e);
      }
    });
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
      var tab = getTabForSelector(currentObj.id);
      if (!isNull(tab)){
        showBulkAnalisysDialog(tab);
      }
    });
    this.$html.find(".analyzeContainer").append($section);
  }

  this.clearBulkAnalisysPlotResults = function () {
    this.$html.find(".BulkAnalisysSection").find(".sectionContainer").html("");
  }

  this.addBulkAnalisysPlotResults = function (plot_id, plot_title) {

    //Adds a plotBulkResults section for this plot bulk data
    var $sectionContainer = this.$html.find(".BulkAnalisysSection").find(".sectionContainer");
    var $plotBulkResults = $('<div class="plotBulkResults ' + plot_id + ' ">' +
                              '<div class="switch-wrapper">' +
                              '  <div id="switch_' + plot_id + '" plot_id="' + plot_id + '" class="switch-btn fa fa-check-square-o" aria-hidden="true"></div>' +
                              '</div>' +
                              '<h4>' + plot_title + '</h4>' +
                              '<div class="plotFilenames"></div>' +
                            '</div>');
    $sectionContainer.append($plotBulkResults);

    //Show and hide plot filenames
    $plotBulkResults.find(".switch-btn").click(function ( event ) {
      var plotId = $(this).attr("plot_id");
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

  //Normal file selectors, SRC is valid on both events files and lightcurves

  this.createSngOrMultiFileSelector();

  this.srcFileSelector = new fileSelector("theSrcFileSelector_" + this.id, "Source File:", "SRC", service.upload_form_data, this.onDatasetChangedFn);
  this.addFileSelector(this.srcFileSelector);

  this.bckFileSelector = new fileSelector("theBckFileSelector_" + this.id, "Background File:", "BCK", service.upload_form_data, this.onDatasetChangedFn);
  this.addFileSelector(this.bckFileSelector);
  this.bckFileSelector.hide();

  this.gtiFileSelector = new fileSelector("theGtiFileSelector_" + this.id, "GTI File:", "GTI", service.upload_form_data, this.onDatasetChangedFn);
  this.addFileSelector(this.gtiFileSelector);
  this.gtiFileSelector.hide();

  this.rmfFileSelector = new fileSelector("theRmfFileSelector_" + this.id, "RMF File:", "RMF", service.upload_form_data, this.onDatasetChangedFn);
  this.addFileSelector(this.rmfFileSelector);
  this.rmfFileSelector.hide();

  //Lightcurve file selectors
  this.lcAFileSelector = new fileSelector("lcAFileSelector_" + this.id, "Lc A File:", "LCA", service.upload_form_data, this.onLcDatasetChangedFn);
  this.addFileSelector(this.lcAFileSelector);
  this.lcAFileSelector.hide();

  this.lcBFileSelector = new fileSelector("lcBFileSelector_" + this.id, "Lc B File:", "LCB", service.upload_form_data, this.onLcDatasetChangedFn);
  this.addFileSelector(this.lcBFileSelector);
  this.lcBFileSelector.hide();

  this.lcCFileSelector = new fileSelector("lcCFileSelector_" + this.id, "Lc C File:", "LCC", service.upload_form_data, this.onLcDatasetChangedFn);
  this.addFileSelector(this.lcCFileSelector);
  this.lcCFileSelector.hide();

  this.lcDFileSelector = new fileSelector("lcDFileSelector_" + this.id, "Lc D File:", "LCD", service.upload_form_data, this.onLcDatasetChangedFn);
  this.addFileSelector(this.lcDFileSelector);
  this.lcDFileSelector.hide();

  //Adds lightcurves background selectors
  this.lcBckFileSelector = new fileSelector("lcBckFileSelector_" + this.id, "Source Background File:", "BCK", service.upload_form_data, this.onDatasetChangedFn);
  this.lcBckFileSelector.hide();
  this.addFileSelector(this.lcBckFileSelector);

  this.lcABckFileSelector = new fileSelector("lcABckFileSelector_" + this.id, "Lc A Background File:", "LCA_BCK", service.upload_form_data, this.onLcDatasetChangedFn);
  this.lcABckFileSelector.hide();
  this.addFileSelector(this.lcABckFileSelector);

  this.lcBBckFileSelector = new fileSelector("lcBBckFileSelector_" + this.id, "Lc B Background File:", "LCB_BCK", service.upload_form_data, this.onLcDatasetChangedFn);
  this.lcBBckFileSelector.hide();
  this.addFileSelector(this.lcBBckFileSelector);

  this.lcCBckFileSelector = new fileSelector("lcCBckFileSelector_" + this.id, "Lc C Background File:", "LCC_BCK", service.upload_form_data, this.onLcDatasetChangedFn);
  this.lcCBckFileSelector.hide();
  this.addFileSelector(this.lcCBckFileSelector);

  this.lcDBckFileSelector = new fileSelector("lcDBckFileSelector_" + this.id, "Lc D Background File:", "LCD_BCK", service.upload_form_data, this.onLcDatasetChangedFn);
  this.lcDBckFileSelector.hide();
  this.addFileSelector(this.lcDBckFileSelector);

  //Filter tab buttons
  this.clearBtn.click(function () {
      currentObj.historyManager.resetHistory();
  });

  this.undoBtn.click(function () {
      currentObj.historyManager.undoHistory();
  });

  this.loadBtn.click(function () {
      currentObj.loadFilters();
  });

  this.saveBtn.click(function () {
      currentObj.saveFilters();
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
  });

  log("ToolPanel ready! classSelector: " + this.classSelector);
  return this;
}
