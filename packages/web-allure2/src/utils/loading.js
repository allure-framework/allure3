import LoaderView from "@/components/loader/LoaderView.js";

export function fetchAndShow(parent, region, collection, view, callback = () => {}) {
  parent.showChildView(region, new LoaderView());
  collection.fetch().then(() => {
    parent.showChildView(region, view);
    callback();
  });
}
