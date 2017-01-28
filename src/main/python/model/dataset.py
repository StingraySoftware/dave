from model.table import Table
import logging

class DataSet:
    id = ""
    tables = dict()

    def __init__(self, id):
        self.id = id
        self.tables = dict()

    def add_table(self, table_id, column_names ):
        self.tables[table_id] = Table (table_id)
        self.tables[table_id].add_columns (column_names)

    def get_schema (self):
        schema = dict()
        for table_id in self.tables:
            schema[table_id] = self.tables[table_id].get_schema()
        return schema

    def clone (self):
        logging.debug("dataset.clone start!!")
        dataset = DataSet(self.id)

        for table_id in self.tables:
            logging.error("dataset.clone table_id: %s" % table_id)
            table = self.tables[table_id].clone()
            dataset.tables[table_id] = table

        logging.debug("dataset.clone end!!")
        return dataset

    def apply_filters(self, filters):

        logging.debug("dataset.apply_filters start!!")
        if not filters or not len(filters):
            logging.debug("dataset.apply_filters wrong filters!!")
            logging.debug(filters)
            return self

        filtered_dataset = self.clone()

        for filter in filters:
            table_id = filter["table"]
            if table_id in filtered_dataset.tables:
                filtered_dataset.tables[table_id] = filtered_dataset.tables[table_id].apply_filter(filter)
            else:
                logging.error("dataset.apply_filters wrong table_id: %s" % table_id)

        logging.debug("dataset.apply_filters end!!")
        return filtered_dataset

    def join (self, dataset):
        logging.debug("dataset.join start!!")
        joined_dataset = self.clone()

        for table_id in joined_dataset.tables:
            if table_id in dataset.tables:
                table = joined_dataset.tables[table_id].join(dataset.tables[table_id])
                joined_dataset.tables[table_id] = table

        logging.debug("dataset.join end!!")
        return joined_dataset
