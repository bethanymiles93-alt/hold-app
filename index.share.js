import { AppRegistry } from "react-native";

import ShareExtension from "./ShareExtension";

// IMPORTANT: the first argument must be "shareExtension" — expo-share-extension's
// own config plugin looks for a bundle registering exactly this name.
AppRegistry.registerComponent("shareExtension", () => ShareExtension);
