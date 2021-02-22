import { $Shape } from "utility-types";

//
//  Copyright (c) 2018-present, Cruise LLC
//
//  This source code is licensed under the Apache License, Version 2.0,
//  found in the LICENSE file in the root directory of this source tree.
//  You may not use this file except in compliance with the License.

import { compact, uniq } from "lodash";
import memoizeWeak from "memoize-weak";
import React, { useEffect, useCallback, useMemo, useRef } from "react";
import { hot } from "react-hot-loader/root";
import { Time, TimeUtil } from "rosbag";

import helpContent from "./index.help.md";
import Flex from "@foxglove-studio/app/components/Flex";
import { MessageHistoryItemsByPath } from "@foxglove-studio/app/components/MessageHistoryDEPRECATED";
import { getTopicsFromPaths } from "@foxglove-studio/app/components/MessagePathSyntax/parseRosPath";
import { useDecodeMessagePathsForMessagesByTopic } from "@foxglove-studio/app/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { useMessagePipeline } from "@foxglove-studio/app/components/MessagePipeline";
import Panel from "@foxglove-studio/app/components/Panel";
import PanelToolbar from "@foxglove-studio/app/components/PanelToolbar";
import {
  getTooltipItemForMessageHistoryItem,
  TooltipItem,
} from "@foxglove-studio/app/components/TimeBasedChart";
import {
  useBlocksByTopic,
  useDataSourceInfo,
  useMessagesByTopic,
} from "@foxglove-studio/app/PanelAPI";
import { BasePlotPath, PlotPath } from "@foxglove-studio/app/panels/Plot/internalTypes";
import PlotChart, {
  getDatasetsAndTooltips,
  PlotDataByPath,
} from "@foxglove-studio/app/panels/Plot/PlotChart";
import PlotLegend from "@foxglove-studio/app/panels/Plot/PlotLegend";
import PlotMenu from "@foxglove-studio/app/panels/Plot/PlotMenu";
import { PanelConfig } from "@foxglove-studio/app/types/panels";
import { useShallowMemo } from "@foxglove-studio/app/util/hooks";
import { fromSec, subtractTimes, toSec } from "@foxglove-studio/app/util/time";

export const plotableRosTypes = [
  "bool",
  "int8",
  "uint8",
  "int16",
  "uint16",
  "int32",
  "uint32",
  "int64",
  "uint64",
  "float32",
  "float64",
  "time",
  "duration",
  "string",
  "json",
];

// X-axis values:
export type PlotXAxisVal =
  | "timestamp" // Message playback time. Preloaded.
  | "index" // Message-path value index. One "current" message at playback time.
  | "custom" // Message path data. Preloaded.
  | "currentCustom"; // Message path data. One "current" message at playback time.

export type PlotConfig = {
  paths: PlotPath[];
  minYValue: string;
  maxYValue: string;
  showLegend: boolean;
  xAxisVal: PlotXAxisVal;
  xAxisPath?: BasePlotPath;
  followingViewWidth?: string;
};

export function openSiblingPlotPanel(
  openSiblingPanel: (arg0: string, cb: (arg0: PanelConfig) => PanelConfig) => void,
  topicName: string,
) {
  openSiblingPanel("Plot", (config: PanelConfig) => ({
    ...config,
    paths: uniq(
      config.paths
        .concat([{ value: topicName, enabled: true, timestampMethod: "receiveTime" }])
        .filter(({ value }: any) => value),
    ),
  }));
}

type Props = {
  config: PlotConfig;
  saveConfig: (arg0: $Shape<PlotConfig>) => void;
};

// messagePathItems contains the whole parsed message, and we don't need to cache all of that.
// Instead, throw away everything but what we need (the timestamps).
const getPlotDataByPath = (itemsByPath: MessageHistoryItemsByPath): PlotDataByPath => {
  const ret: PlotDataByPath = {};
  Object.keys(itemsByPath).forEach((path) => {
    ret[path] = [itemsByPath[path].map(getTooltipItemForMessageHistoryItem)];
  });
  return ret;
};

const getMessagePathItemsForBlock = memoizeWeak(
  (decodeMessagePathsForMessagesByTopic: any, block: any): PlotDataByPath => {
    return Object.freeze(getPlotDataByPath(decodeMessagePathsForMessagesByTopic(block)));
  },
);

const ZERO_TIME = { sec: 0, nsec: 0 };

function getBlockItemsByPath(decodeMessagePathsForMessagesByTopic: any, blocks: any) {
  const ret = {};
  const lastBlockIndexForPath: any = {};
  blocks.forEach((block: any, i: number) => {
    const messagePathItemsForBlock: PlotDataByPath = getMessagePathItemsForBlock(
      decodeMessagePathsForMessagesByTopic,
      block,
    );
    Object.keys(messagePathItemsForBlock).forEach((path) => {
      const existingItems: TooltipItem[][] = (ret as any)[path] || [];
      // getMessagePathItemsForBlock returns an array of exactly one range of items.
      const [pathItems] = messagePathItemsForBlock[path];
      if (lastBlockIndexForPath[path] === i - 1) {
        // If we are continuing directly from the previous block index (i - 1) then add to the
        // existing range, otherwise start a new range
        const currentRange = existingItems[existingItems.length - 1];
        for (const item of pathItems) {
          currentRange.push(item);
        }
      } else {
        // Start a new contiguous range. Make a copy so we can extend it.
        existingItems.push(pathItems.slice());
      }
      (ret as any)[path] = existingItems;
      lastBlockIndexForPath[path] = i;
    });
  });
  return ret;
}

function Plot(props: Props) {
  const { saveConfig, config } = props;
  const {
    followingViewWidth,
    paths: yAxisPaths,
    minYValue,
    maxYValue,
    showLegend,
    xAxisVal,
    xAxisPath,
  } = config;
  // Note that the below values are refs since they are only used in callbacks and are not rendered anywhere.
  const currentMinY = useRef<number | null>(null);
  const currentMaxY = useRef<number | null>(null);
  const currentViewWidth = useRef<number | null>(null);

  const saveCurrentView = useCallback((minY: number, maxY: number, width: number) => {
    currentMinY.current = minY;
    currentMaxY.current = maxY;
    currentViewWidth.current = width;
  }, []);

  const setWidth = useCallback(
    () =>
      saveConfig({
        followingViewWidth:
          currentViewWidth.current != null ? currentViewWidth.current.toString() : "",
      }),
    [saveConfig],
  );

  const setMinMax = useCallback(
    () =>
      saveConfig({
        minYValue: currentMinY.current != null ? currentMinY.current.toString() : "",
        maxYValue: currentMaxY.current != null ? currentMaxY.current.toString() : "",
      }),
    [currentMaxY, currentMinY, saveConfig],
  );

  useEffect(() => {
    if (!yAxisPaths.length) {
      saveConfig({ paths: [{ value: "", enabled: true, timestampMethod: "receiveTime" }] });
    }
  });

  const showSingleCurrentMessage = xAxisVal === "currentCustom" || xAxisVal === "index";
  const historySize = showSingleCurrentMessage ? 1 : Infinity;

  const allPaths = yAxisPaths.map(({ value }) => value).concat(compact([xAxisPath?.value]));
  const memoizedPaths: string[] = useShallowMemo<string[]>(allPaths);
  const subscribeTopics = useMemo(() => getTopicsFromPaths(memoizedPaths), [memoizedPaths]);
  const messagesByTopic = useMessagesByTopic({
    topics: subscribeTopics,
    historySize,
    // This subscription is used for two purposes:
    //  1. A fallback for preloading when blocks are not available (nodes, websocket.)
    //  2. Playback-synced plotting of index/custom data.
    preloadingFallback: !showSingleCurrentMessage,
    format: "bobjects",
  });

  const decodeMessagePathsForMessagesByTopic = useDecodeMessagePathsForMessagesByTopic(
    memoizedPaths,
  );

  const streamedItemsByPath = useMemo(
    () => getPlotDataByPath(decodeMessagePathsForMessagesByTopic(messagesByTopic)),
    [decodeMessagePathsForMessagesByTopic, messagesByTopic],
  );

  const { blocks } = useBlocksByTopic(subscribeTopics);
  const blockItemsByPath = useMemo(
    () =>
      showSingleCurrentMessage
        ? {}
        : getBlockItemsByPath(decodeMessagePathsForMessagesByTopic, blocks),
    [showSingleCurrentMessage, decodeMessagePathsForMessagesByTopic, blocks],
  );
  const { startTime } = useDataSourceInfo();

  // If every streaming key is in the blocks, just use the blocks object for a stable identity.
  const mergedItems = Object.keys(streamedItemsByPath).every(
    (path) => (blockItemsByPath as any)[path] != null,
  )
    ? blockItemsByPath
    : { ...streamedItemsByPath, ...blockItemsByPath };

  // Don't filter out disabled paths when passing into getDatasetsAndTooltips, because we still want
  // easy access to the history when turning the disabled paths back on.
  const { datasets, tooltips, pathsWithMismatchedDataLengths } = useMemo(
    // TODO(steel): This memoization isn't quite ideal: getDatasetsAndTooltips is a bit expensive
    // with lots of preloaded data, and when we preload a new block we re-generate the datasets for
    // the whole timeline. We should try to use block memoization here.
    () =>
      getDatasetsAndTooltips(yAxisPaths, mergedItems, startTime || ZERO_TIME, xAxisVal, xAxisPath),
    [yAxisPaths, mergedItems, startTime, xAxisVal, xAxisPath],
  );

  const { currentTime, endTime, seekPlayback: seek } = useMessagePipeline(
    useCallback(
      ({ seekPlayback, playerState: { activeData } }) => ({
        currentTime: activeData?.currentTime,
        endTime: activeData?.endTime,
        seekPlayback,
      }),
      [],
    ),
  );
  // Min/max x-values and playback position indicator are only used for preloaded plots. In non-
  // preloaded plots min x-value is always the last seek time, and the max x-value is the current
  // playback time.
  const timeToXValueForPreloading = (t: Time | null | undefined): number | null | undefined => {
    if (xAxisVal === "timestamp" && t && startTime) {
      return toSec(subtractTimes(t, startTime));
    }
  };
  const preloadingDisplayTime = timeToXValueForPreloading(currentTime);
  const preloadingStartTime = timeToXValueForPreloading(startTime); // zero or undefined
  const preloadingEndTime = timeToXValueForPreloading(endTime);
  let defaultView;
  if (preloadingDisplayTime != null) {
    if (followingViewWidth != null && parseFloat(followingViewWidth) > 0) {
      // Will be ignored in TimeBasedChart for non-preloading plots and non-timestamp plots.
      defaultView = { type: "following", width: parseFloat(followingViewWidth) };
    } else if (preloadingStartTime != null && preloadingEndTime != null) {
      defaultView = { type: "fixed", minXValue: preloadingStartTime, maxXValue: preloadingEndTime };
    }
  }

  const onClick = useCallback(
    (_, __, { X_AXIS_ID: seekSeconds }) => {
      if (!startTime || seekSeconds == null || !seek || xAxisVal !== "timestamp") {
        return;
      }
      // The player validates and clamps the time.
      const seekTime = TimeUtil.add(startTime, fromSec(seekSeconds));
      seek(seekTime);
    },
    [seek, startTime, xAxisVal],
  );

  return (
    <Flex col clip center style={{ position: "relative" }}>
      <PanelToolbar
        helpContent={helpContent}
        floating
        menuContent={
          <PlotMenu
            displayWidth={followingViewWidth || ""}
            minYValue={minYValue}
            maxYValue={maxYValue}
            saveConfig={saveConfig}
            setMinMax={setMinMax}
            setWidth={setWidth}
            datasets={datasets}
            xAxisVal={xAxisVal}
            tooltips={tooltips}
          />
        }
      />
      <PlotChart
        paths={yAxisPaths}
        minYValue={parseFloat(minYValue)}
        maxYValue={parseFloat(maxYValue)}
        saveCurrentView={saveCurrentView as any}
        datasets={datasets}
        tooltips={tooltips}
        xAxisVal={xAxisVal}
        currentTime={preloadingDisplayTime}
        onClick={onClick}
        defaultView={defaultView as any}
      />
      <PlotLegend
        paths={yAxisPaths}
        saveConfig={saveConfig}
        showLegend={showLegend}
        xAxisVal={xAxisVal}
        xAxisPath={xAxisPath}
        pathsWithMismatchedDataLengths={pathsWithMismatchedDataLengths}
      />
    </Flex>
  );
}
Plot.panelType = "Plot";
Plot.defaultConfig = {
  paths: [{ value: "", enabled: true, timestampMethod: "receiveTime" }],
  minYValue: "",
  maxYValue: "",
  showLegend: true,
  xAxisVal: "timestamp",
};

export default hot(Panel<PlotConfig>(Plot as any));