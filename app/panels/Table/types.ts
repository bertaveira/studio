//
//  Copyright (c) 2020-present, Cruise LLC
//
//  This source code is licensed under the Apache License, Version 2.0,
//  found in the LICENSE file in the root directory of this source tree.
//  You may not use this file except in compliance with the License.

import * as React from "react";

// Since flow-types do not exist for react-table, this is a rough approximation
// of what the types react-table gives us, which is pulled from
// https://react-table.tanstack.com/docs/api/overview.
//
// There is an entry in definitely-typed for react-table here:
// https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/react-table
// which we can use in the future for reference. Unfortunately flowgen could not
// easily convert these types.

type CellProps<C, R> = {
  column: C;
  row: R;
  cell: any;
  value: any;
};

type Cell = {
  getCellProps(): any;
  render(props: any): React.ReactElement<any>;
};

type Row = {
  cells: Cell[];
  allCells: Cell[];
  values: any;
  getRowProps(): void;
  index: number;
  original: any;
  subRows: Row[];
  state: any;

  // useExpanded properties.
  getToggleRowExpandedProps(): any;
  isExpanded: boolean;
};

export type PaginationProps = {
  pageCount: number;
  page: Row[];
  pageOptions: number[];
  canPreviousPage: boolean;
  canNextPage: boolean;
  gotoPage(index: number): void;
  previousPage(): void;
  nextPage(): void;
  setPageSize(size: number): void;
};

export type PaginationState = {
  pageSize: number;
  pageIndex: number;
};

type ColumnInstance = {
  id: string;
  isVisible: boolean;
  render(props: any): React.ReactElement<any>;
  totalLeft: number;
  totalWidth: number;
  getHeaderProps(
    props: any,
  ): {
    // no-op
  };
  toggleHidden(hidden: boolean): void;
  getToggleHiddenProps(
    userProps: any,
  ): {
    // no-op
  };
  // useSortBy properties.
  isSorted?: boolean;
  isSortedDesc?: boolean;
  getSortByToggleProps(): {
    // no-op
  };
};

export type ColumnOptions = {
  Header?: string | (() => React.ReactElement<any> | null | undefined);
  accessor?: string;
  columns?: ColumnOptions[];
  Cell?: (props: CellProps<ColumnInstance, Row>) => any;
  id?: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
};

type HeaderGroup = {
  headers: ColumnInstance[];
  getHeaderGroupProps(): any;
  getFooterGroupProps(): any;
};

export type TableInstance<HookInstances, HookState> = HookInstances & {
  state: HookState;
  columns: ColumnInstance[];
  allColumns: ColumnInstance[];
  visibleColumns: ColumnInstance[];
  headerGroups: HeaderGroup[];
  footerGroups: HeaderGroup[];
  headers: ColumnInstance[];
  flatHeaders: ColumnInstance[];
  rows: Row[];
  getTableProps(): any;
  getTableBodyProps(): any;
  // Responsible for lazily preparing a row for rendering.
  prepareRow(row: Row): void;
  flatRows: Row[];
  totalColumnsWidth: number;
  toggleHideColumn(columnId: string, value: boolean | null | undefined): void;
  setHiddenColumns(columnIds: string[]): void;
  toggleHideAllColumns(val: boolean | null | undefined): void;
  getToggleHideAllColumnsProps(userProps: any): any;
};