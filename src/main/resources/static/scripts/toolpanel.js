
function ToolPanel (classSelector, service, onSrcDatasetChangedFn, onBckDatasetChangedFn, onFiltersChangedFn) {

  var currentObj = this;

  this.classSelector = classSelector;
  this.$html = $(this.classSelector);
  this.buttonsContainer = this.$html.find(".buttonsContainer");
  this.clearBtn = this.$html.find(".btnClear");

  this.onSrcDatasetChangedFn = onSrcDatasetChangedFn;
  this.onBckDatasetChangedFn = onBckDatasetChangedFn;
  this.onFiltersChanged = onFiltersChangedFn;

  this.lastTimeoutId = null;

  var theSrcFileSelector = new fileSelector("theSrcFileSelector", "Src File:", service.upload_form_data, this.onSrcDatasetChangedFn);
  this.$html.find(".fileSelectorsContainer").append(theSrcFileSelector.$html);

  var theBckFileSelector = new fileSelector("theBckFileSelector", "Bck File:", service.upload_form_data, this.onBckDatasetChangedFn);
  this.$html.find(".fileSelectorsContainer").append(theBckFileSelector.$html);

  this.clearBtn.button().bind("click", function( event ) {
      event.preventDefault();
      sliderSelectors_clear();
      currentObj.onSelectorValuesChanged();
  });

  this.showPanel = function ( panel ) {
    this.$html.find(".panelContainer").hide();
    this.$html.find("." + panel).show();
  }

  this.onDatasetSchemaChanged = function ( schema ) {

    sliderSelectors_remove();

    //Adds the Bin selector
    if (theBinSelector != null){
      theBinSelector.$html.remove();
    }

    var minBinSize = 1;
    var maxBinSize = 1;
    var initValue = 1;
    var step = 1;
    if (schema["EVENTS"] !== undefined){

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
    }
    theBinSelector = binSelector("binSelector",
                  "BIN SIZE:",
                  "From",
                  minBinSize, maxBinSize, step, initValue,
                  this.onSelectorValuesChanged);
    this.$html.find(".selectorsContainer").append(theBinSelector.$html);

    var pi_column = null;

    //Adds the rest of selectors from dataset columns
    for (tableName in schema) {
      if (tableName != "GTI") {

        var table = schema[tableName];

        for (columnName in table) {
          if ((columnName != "HEADER") && (columnName != "HEADER_COMMENTS")) {
            var column = table[columnName];
            var filterData = { table:tableName, column:columnName };
            var selector = new sliderSelector(columnName,
                                              columnName + ":",
                                              filterData,
                                              "From", "To",
                                              column.min_value, column.max_value,
                                              this.onSelectorValuesChanged);
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
      var selector = new sliderSelector("selector_" + selectorKey,
                                        selectorName + ":",
                                        filterData,
                                        "From", "To",
                                        column.min_value, column.max_value,
                                        this.onSelectorValuesChanged);
      var min_value = increment * i;
      var max_value = min_value + increment;
      selector.setValues (min_value, max_value);
      selector.setEnabled (true);
      this.$html.find(".selectorsContainer").append(selector.$html);
    }
  }

  this.applyFilters = function (filters) {
    sliderSelectors_applyFilters(filters);
  }

  this.getFilters = function (filters) {
    return sliderSelectors_getFilters();
  }

  this.onSelectorValuesChanged = function (source) {
    if (this.lastTimeoutId != null) {
      clearTimeout(this.lastTimeoutId);
    }

    this.lastTimeoutId = setTimeout( function () {
      theToolPanel.onFiltersChanged(theFilename, sliderSelectors_getFilters(source));
    }, 850);
  }

  log("ToolPanel ready! classSelector: " + this.classSelector);
}
