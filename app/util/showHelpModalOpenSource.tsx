//
//  Copyright (c) 2019-present, Cruise LLC
//
//  This source code is licensed under the Apache License, Version 2.0,
//  found in the LICENSE file in the root directory of this source tree.
//  You may not use this file except in compliance with the License.
import * as React from "react";

import HelpModal from "@foxglove-studio/app/components/HelpModal";
// @ts-expect-error flow import has 'any' type
import messagePathSyntax from "@foxglove-studio/app/components/MessagePathSyntax/index.help.md";
import renderToBody from "@foxglove-studio/app/components/renderToBody";
// @ts-expect-error flow import has 'any' type
import helpContent from "@foxglove-studio/app/util/helpModalOpenSource.help.md";

export function showHelpModalOpenSource(event: React.MouseEvent<any> | null | undefined) {
  const modal = renderToBody(
    <HelpModal
      onRequestClose={() => modal.remove()}
    >{`${helpContent}\n\n#${messagePathSyntax}`}</HelpModal>,
  );
  if (event) {
    // If used as an onClick callback for links, disable the default link action.
    event.preventDefault();
  }
}
