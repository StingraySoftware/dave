
function ToolPanel (id, classSelector, container, service, onSrcDatasetChangedFn, onBckDatasetChangedFn, onGtiDatasetChangedFn, onFiltersChangedFn) {

  var currentObj = this;

  this.id = id;
  this.classSelector = classSelector;
  this.$html = cloneHtmlElement(id, classSelector);
  container.html(this.$html);
  this.$html.show();

  this.buttonsContainer = this.$html.find(".buttonsContainer");
  this.clearBtn = this.$html.find(".btnClear");

  this.onSrcDatasetChangedFn = onSrcDatasetChangedFn;
  this.onBckDatasetChangedFn = onBckDatasetChangedFn;
  this.onGtiDatasetChangedFn = onGtiDatasetChangedFn;
  this.onFiltersChanged = onFiltersChangedFn;

  this.lastTimeoutId = null;

  this.selectors_array = [];

  this.srcFileSelector = new fileSelector("theSrcFileSelector_" + this.id, "Src File:", service.upload_form_data, this.onSrcDatasetChangedFn);
  this.$html.find(".fileSelectorsContainer").append(this.srcFileSelector.$html);

  this.bckFileSelector = new fileSelector("theBckFileSelector_" + this.id, "Bck File:", service.upload_form_data, this.onBckDatasetChangedFn);
  this.$html.find(".fileSelectorsContainer").append(this.bckFileSelector.$html);

  this.gtiFileSelector = new fileSelector("theGtiFileSelector_" + this.id, "Gti File:", service.upload_form_data, this.onGtiDatasetChangedFn);
  this.$html.find(".fileSelectorsContainer").append(this.gtiFileSelector.$html);

  this.clearBtn.button().bind("click", function( event ) {
      event.preventDefault();
      sliderSelectors_clear(currentObj.selectors_array);
      currentObj.onSelectorValuesChanged();
  });

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

    if (schema["EVENTS"] !== undefined){

      var minBinSize = 1;
      var maxBinSize = 1;
      var initValue = 1;
      var step = 1;

      //Caluculates max, min and step values for slider from time ranges
      var binSize = (schema["EVENTS"]["TIME"].max_value - schema["EVENTS"]["TIME"].min_value) / MIN_PLOT_POINTS;
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

      initValue = (maxBinSize - minBinSize) / 50; // Start initValue triying to plot at least 50 points
      projectConfig.binSize = initValue;

      this.binSelector = new BinSelector(this.id + "_binSelector",
                                        "BIN SIZE (" + projectConfig.timeUnit  + "):",
                                        "From",
                                        minBinSize, maxBinSize, step, initValue,
                                        this.onSelectorValuesChanged);
      this.$html.find(".selectorsContainer").append(this.binSelector.$html);

    } else if (schema["RATE"] !== undefined){
      var binDiv = $('<div class="sliderSelector binLabel">' +
                      '<h3>BIN SIZE (' + projectConfig.timeUnit  + '): ' + projectConfig.binSize + '</h3>' +
                    '</div>');
      this.$html.find(".selectorsContainer").append(binDiv);
    }

    var pi_column = null;

    //Adds the rest of selectors from dataset columns
    for (tableName in schema) {
      if (tableName != "GTI") {

        var table = schema[tableName];

        for (columnName in table) {
          if ((columnName != "HEADER") && (columnName != "HEADER_COMMENTS")) {
            var column = table[columnName];
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

            if (tableName == "EVENTS" && columnName == "PI") {
              pi_column = column;
            }
          }
        }

        this.buttonsContainer.removeClass("hidden");
        this.buttonsContainer.fadeIn();
      }
    }

    if (pi_column != null){
      this.createColorSelectors (pi_column);
    }
  }

  this.createColorSelectors = function (column) {
    var selectorNames = ["Color A", "Color B", "Color C", "Color D"];
    var increment = column.max_value * (1 / selectorNames.length);
    for (i in selectorNames) {
      var selectorName = selectorNames[i];
      var selectorKey = selectorName.replace(" ", "_");
      var filterData = { table:"EVENTS", column:selectorKey, source:"ColorSelector" };
      var selector = new sliderSelector(this.id + "_selector_" + selectorKey,
                                        selectorName + ":",
                                        filterData,
                                        "From", "To",
                                        column.min_value, column.max_value,
                                        this.onSelectorValuesChanged,
                                        this.selectors_array);
      var min_value = increment * i;
      var max_value = min_value + increment;
      selector.setValues (min_value, max_value);
      selector.setEnabled (true);
      this.$html.find(".selectorsContainer").append(selector.$html);
    }
  }

  this.applyFilters = function (filters) {
    sliderSelectors_applyFilters(filters, this.selectors_array);
  }

  this.getFilters = function (filters) {
    return sliderSelectors_getFilters(null, this.selectors_array);
  }

  this.onSelectorValuesChanged = function (source) {

    waitingTab = getTabForSelector(currentObj.id);

    if (currentObj.lastTimeoutId != null) {
      clearTimeout(currentObj.lastTimeoutId);
    }

    currentObj.lastTimeoutId = setTimeout( function () {
      var filters = sliderSelectors_getFilters(source, waitingTab.toolPanel.selectors_array)
      waitingTab.onFiltersChanged(filters);
    }, 850);
  }

  log("ToolPanel ready! classSelector: " + this.classSelector);
}
