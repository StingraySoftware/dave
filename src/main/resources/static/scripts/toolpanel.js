
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

  var theBckFileSelector = new fileSelector("theBckFileSelector", "Bck File:", service.upload_form_data, this.onBckDatasetChangedFn);
  this.$html.prepend(theBckFileSelector.$html);

  var theSrcFileSelector = new fileSelector("theSrcFileSelector", "Src File:", service.upload_form_data, this.onSrcDatasetChangedFn);
  this.$html.prepend(theSrcFileSelector.$html);

  this.clearBtn.button().bind("click", function( event ) {
      event.preventDefault();
      sliderSelectors_clear();
      currentObj.onSelectorValuesChanged();
  });

  this.onDatasetSchemaChanged = function ( schema ) {

    sliderSelectors_remove();

    for (tableName in schema) {
      if (tableName != "GTI") {

        var table = schema[tableName];

        for (columnName in table) {

          var column = table[columnName];
          var filterData = { table:tableName, column:columnName };
          var selector = new sliderSelector(columnName,
                                            columnName + ":",
                                            filterData,
                                            "From", "To",
                                            column.min_value, column.max_value,
                                            this.onSelectorValuesChanged);
          this.$html.find(".selectorsContainer").append(selector.$html);
        }

        this.buttonsContainer.removeClass("hidden");
        this.buttonsContainer.fadeIn();
      }
    }
  }

  this.applyFilters = function (filters) {
    sliderSelectors_applyFilters(filters);
  }

  this.onSelectorValuesChanged = function ( ) {

    if (this.lastTimeoutId != null) {
      clearTimeout(this.lastTimeoutId);
    }

    this.lastTimeoutId = setTimeout( function () {
      theToolPanel.onFiltersChanged(theFilename, sliderSelectors_getFilters ());
    }, 850);
  }

  log("ToolPanel ready! classSelector: " + this.classSelector);
}
