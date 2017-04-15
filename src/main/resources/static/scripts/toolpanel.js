
function ToolPanel (id,
                    classSelector,
                    container,
                    service,
                    onDatasetChangedFn,
                    onLcDatasetChangedFn,
                    onFiltersChangedFn,
                    undoHistoryFn,
                    resetHistoryFn,
                    onDragDropChangedFn)
{

  var currentObj = this;

  this.id = id;
  this.classSelector = classSelector;
  this.$html = cloneHtmlElement(id, classSelector);
  container.html(this.$html);
  this.$html.show();

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
  this.undoHistory = undoHistoryFn;
  this.resetHistory = resetHistoryFn;
  this.onDragDropChanged = onDragDropChangedFn;

  this.lastTimeoutId = null;
  this.dragDropEnabled = false;

  this.file_selectors_ids_array = [];
  this.selectors_array = [];

  this.addFileSelector = function (selector) {
    this.$html.find(".fileSelectorsContainer").append(selector.$html);
    this.file_selectors_ids_array.push(selector.id);
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

  this.showEventsSelectors = function ( panel ) {
    this.bckFileSelector.show();
    this.gtiFileSelector.show();
    this.rmfFileSelector.show();
    this.arfFileSelector.show();
    this.lcAFileSelector.hide();
    this.lcBFileSelector.hide();
    this.lcCFileSelector.hide();
    this.lcDFileSelector.hide();
  }

  this.showLcSelectors = function ( panel ) {
    this.bckFileSelector.hide();
    this.gtiFileSelector.hide();
    this.rmfFileSelector.hide();
    this.arfFileSelector.hide();
    this.lcAFileSelector.show();
    this.lcBFileSelector.show();
    this.lcCFileSelector.show();
    this.lcDFileSelector.show();
  }

  this.showPanel = function ( panel ) {
    this.$html.find(".panelContainer").hide();
    this.$html.find("." + panel).show();
  }

  this.onDatasetSchemaChanged = function ( projectConfig ) {

    var schema = projectConfig.schema;

    currentObj.selectors_array = [];
    currentObj.$html.find(".sliderSelector").remove();

    //Adds the Bin selector
    if (this.binSelector != null){
      this.binSelector.$html.remove();
    }

    var maxTimeRange = -1;
    var timeRatio = 1;

    if (schema["EVENTS"] !== undefined){

      //SRC file is an EVENTS file:

      this.showEventsSelectors();

      if (isNull(schema["EVENTS"]["PHA"])){
          //PHA Column doesn't exist, show we can't apply RMF or ARF files
          this.rmfFileSelector.disable("PHA column not found in SRC file");
          this.arfFileSelector.disable("PHA column not found in SRC file");
      }

      var minBinSize = 1;
      var maxBinSize = 1;
      var initValue = 1;
      var step = 1;

      //Caluculates max, min and step values for slider from time ranges
      var timeColumn = schema["EVENTS"]["TIME"];
      maxTimeRange = timeColumn.max_value - timeColumn.min_value;
      if (timeColumn.count > MAX_PLOT_POINTS) {
        timeRatio = MAX_PLOT_POINTS / timeColumn.count;
        maxTimeRange *= timeRatio;
      }
      var binSize = maxTimeRange / MIN_PLOT_POINTS;
      var multiplier = 1;

      //If binSize is smaller than 1.0 find the divisor
      while (binSize * multiplier < 1)
      {
        multiplier *= 10;
      }

      var tmpStep = (1.0 / multiplier) / 100.0;
      if ((binSize / tmpStep) > MAX_PLOT_POINTS) {
        //Fix step for not allowing more plot point than MAX_PLOT_POINTS
        tmpStep = binSize / MAX_PLOT_POINTS;
      }
      minBinSize = tmpStep;
      maxBinSize = binSize;
      step = minBinSize / 100.0; // We need at least 100 steps on slider

      if (projectConfig.minBinSize > 0) {
        initValue = projectConfig.minBinSize;
        minBinSize = projectConfig.minBinSize;
        step = projectConfig.minBinSize;
      } else {
        initValue = (maxBinSize - minBinSize) / 50; // Start initValue triying to plot at least 50 points
      }

      projectConfig.binSize = initValue;

      this.binSelector = new BinSelector(this.id + "_binSelector",
                                        "BIN SIZE (" + projectConfig.timeUnit  + "):",
                                        "From",
                                        minBinSize, maxBinSize, step, initValue,
                                        this.onSelectorValuesChanged);
      this.$html.find(".selectorsContainer").append(this.binSelector.$html);

    } else if (schema["RATE"] !== undefined){

      //SRC file is an LIGHTCURVE file:

      this.showLcSelectors();

      var binDiv = $('<div class="sliderSelector binLabel">' +
                      '<h3>BIN SIZE (' + projectConfig.timeUnit  + '): ' + projectConfig.binSize + '</h3>' +
                    '</div>');
      this.$html.find(".selectorsContainer").append(binDiv);

      var timeColumn = schema["RATE"]["TIME"];
      maxTimeRange = timeColumn.max_value - timeColumn.min_value;
      if (timeColumn.count > MAX_PLOT_POINTS) {
        timeRatio = MAX_PLOT_POINTS / timeColumn.count;
        maxTimeRange *= timeRatio;
      }
    }

    var pha_column = null;

    //Adds the rest of selectors from dataset columns
    for (tableName in schema) {
      if (tableName != "GTI") {

        var table = schema[tableName];

        for (columnName in table) {
          var column = table[columnName];
          if ((columnName != "HEADER") && (columnName != "HEADER_COMMENTS") && (columnName != "E") && column.min_value < column.max_value) {
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
                                              this.selectors_array);
            this.$html.find(".selectorsContainer").append(selector.$html);

            if ((columnName == "TIME") && (timeRatio < 1)) { //If full events were cropped to MAX_PLOT_POINTS
                selector.setMaxRange(maxTimeRange);
                selector.setEnabled (true);
            }

            if (tableName == "EVENTS" && columnName == "PHA") {
              pha_column = column;
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
                                      '<h3>Color filter type</h3>' +
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
  }

  this.createColorSelectors = function (column) {
    var selectorNames = ["Color A", "Color B", "Color C", "Color D"];
    var increment = (column.max_value - column.min_value) * (1 / selectorNames.length);
    var container = $("<div class='colorSelectors_" + column.id + "'></div>");

    for (i in selectorNames) {
      var selectorName = selectorNames[i];
      var selectorKey = selectorName.replace(" ", "_");
      var filterData = { table:"EVENTS", column:selectorKey, source:"ColorSelector", replaceColumn: column.id };
      var selector = new sliderSelector(this.id + "_selector_" + selectorKey + "_" + column.id,
                                        selectorName + ":",
                                        filterData,
                                        "From", "To",
                                        column.min_value, column.max_value,
                                        this.onSelectorValuesChanged,
                                        this.selectors_array);
      var min_value = column.min_value + (increment * i);
      var max_value = min_value + increment;
      selector.setValues (min_value, max_value);
      selector.setEnabled (true);
      container.append(selector.$html);
    }

    this.$html.find(".colorSelectorsContainer").append(container);
  }

  this.onRmfDatasetUploaded = function ( schema ) {
    if (!isNull(schema["EVENTS"])) {
        table = schema["EVENTS"];
        if (!isNull(table["E"])){
          //Adds Energy general filter
          var column = table["E"];
          var selector = new sliderSelector(this.id + "_Energy",
                                            "Energy (keV):",
                                            { table:"EVENTS", column:"E" },
                                            "From", "To",
                                            column.min_value, column.max_value,
                                            this.onSelectorValuesChanged,
                                            this.selectors_array);
          selector.$html.insertAfter("." + this.id + "_TIME");

          //Prepares Energy color filters
          this.createColorSelectors(column);
          this.onColorFilterTypeChanged("E");
        }
    }
  }

  this.applyFilters = function (filters) {
    sliderSelectors_applyFilters(filters, currentObj.selectors_array);
  }

  this.setFilters = function (filters) {
    sliderSelectors_setFilters(filters, currentObj.selectors_array);
  }

  this.getFilters = function () {
    return sliderSelectors_getFilters(currentObj.selectors_array);
  }

  this.onSelectorValuesChanged = function () {
    currentObj.refreshFloatingBtn.show();
  }

  this.onColorFilterTypeChanged = function (columnName) {
    var selectorsContainer = currentObj.$html.find(".colorSelectorsContainer");
    selectorsContainer.children().hide();

    if (columnName == "E") {
      var tab = getTabForSelector(currentObj.id);
      if (tab.projectConfig.rmfFilename == "") {

        //Show upload RMF file
        var rmfFileDiv = $('<div class="rmfFileDiv"></div>');
        if (rmfFileDiv.children().length == 0) {
          var rmfBtn = $('<button class="btn btn-warning btnRmf"> Upload RMF file </button>');
          rmfBtn.click(function () {
            currentObj.rmfFileSelector.$html.find("#" + currentObj.rmfFileSelector.uploadInputId).focus().click();
          });
          rmfFileDiv.html('<p class="text-warning">RMF file is requiered for processing energy values:</p>');
          rmfFileDiv.append(rmfBtn);
          selectorsContainer.append(rmfFileDiv);
        }
        rmfFileDiv.show();

      } else {
        //Show ENERGY color selectors
        sliderSelectors_setFiltersEnabled (currentObj.selectors_array, "ColorSelector", "E");
        selectorsContainer.find(".colorSelectors_E").show();
        currentObj.onSelectorValuesChanged();
      }
    } else {
      //Show PHA color selectors
      sliderSelectors_setFiltersEnabled (currentObj.selectors_array, "ColorSelector", "PHA");
      selectorsContainer.find(".colorSelectors_PHA").show();
      currentObj.onSelectorValuesChanged();
    }
  }

  this.refresh = function () {
    currentObj.refreshFloatingBtn.hide();
    var filters = sliderSelectors_getFilters(currentObj.selectors_array)
    getTabForSelector(currentObj.id).onFiltersChanged(filters);
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

  this.saveFilters = function () {
    var filename = getTabForSelector(currentObj.id).projectConfig.filename.replace(/\./g,'');;
    var filters = sliderSelectors_getFilters(currentObj.selectors_array);
    var action = { type: "filters", actionData: $.extend(true, [], filters), binSize: this.binSelector.value };
    var a = document.createElement("a");
    var file = new Blob([JSON.stringify(action)], {type: 'text/plain'});
    a.href = URL.createObjectURL(file);
    a.download = filename + "_filters.json";
    a.click();
  }

  this.loadFilters = function () {
    var input = $('<input type="file" id="load-input" />');
    input.on('change', function (e) {
      if (e.target.files.length == 1) {
        var file = e.target.files[0];
        var reader = new FileReader();
          reader.onload = function(e) {
            try {
              var action = JSON.parse(e.target.result);
              getTabForSelector(currentObj.id).applyAction(action);
            } catch (e) {
              log("ToolPanel error loading filters: " + e);
            }
          };
          reader.readAsText(file);
      }
     });
     input.click();
  }

  //Normal file selectors, SRC is valid on both events files and lightcurves
  this.srcFileSelector = new fileSelector("theSrcFileSelector_" + this.id, "Src File:", "SRC", service.upload_form_data, this.onDatasetChangedFn);
  this.addFileSelector(this.srcFileSelector);

  this.bckFileSelector = new fileSelector("theBckFileSelector_" + this.id, "Bck File:", "BCK", service.upload_form_data, this.onDatasetChangedFn);
  this.addFileSelector(this.bckFileSelector);
  this.bckFileSelector.hide();

  this.gtiFileSelector = new fileSelector("theGtiFileSelector_" + this.id, "Gti File:", "GTI", service.upload_form_data, this.onDatasetChangedFn);
  this.addFileSelector(this.gtiFileSelector);
  this.gtiFileSelector.hide();

  this.rmfFileSelector = new fileSelector("theRmfFileSelector_" + this.id, "Rmf File:", "RMF", service.upload_form_data, this.onDatasetChangedFn);
  this.addFileSelector(this.rmfFileSelector);
  this.rmfFileSelector.hide();

  this.arfFileSelector = new fileSelector("theArfFileSelector_" + this.id, "Arf File:", "ARF", service.upload_form_data, this.onDatasetChangedFn);
  this.addFileSelector(this.arfFileSelector);
  this.arfFileSelector.hide();

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

  this.clearBtn.bind("click", function( event ) {
      currentObj.resetHistory();
  });

  this.undoBtn.bind("click", function( event ) {
      currentObj.undoHistory();
  });

  this.loadBtn.bind("click", function( event ) {
      currentObj.loadFilters();
  });

  this.saveBtn.bind("click", function( event ) {
      currentObj.saveFilters();
  });

  this.refreshBtn.bind("click", function( event ) {
      currentObj.refresh();
  });

  this.refreshFloatingBtn.hide();
  this.refreshFloatingBtn.bind("click", function( event ) {
      currentObj.refresh();
  });

  this.dragDropBtn.bind("click", function( event ) {
      currentObj.dragDropBtn.toggleClass("btn-success");
      currentObj.dragDropEnabled = currentObj.dragDropBtn.hasClass("btn-success");
      currentObj.onDragDropChanged(currentObj.dragDropEnabled);
  });

  log("ToolPanel ready! classSelector: " + this.classSelector);
}
