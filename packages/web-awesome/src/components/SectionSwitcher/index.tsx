import { PageLoader } from "@allurereport/web-components";
import type { ComponentType } from "preact";
import { useEffect, useState } from "preact/hooks";

import { Report } from "@/components/Report";
import { currentSection } from "@/stores/sections";

import * as styles from "./styles.scss";

type SectionName = "report" | "charts" | "timeline";

const sectionLoaders: Record<Exclude<SectionName, "report">, () => Promise<ComponentType>> = {
  charts: () => import("@/components/Charts").then((module) => module.Charts),
  timeline: () => import("@/components/Timeline").then((module) => module.Timeline),
};

const sectionCache = new Map<string, ComponentType>();

type LoadedSection = {
  section: SectionName;
  Component: ComponentType;
};

const LazySection = ({ section }: { section: SectionName }) => {
  const cached = sectionCache.get(section);
  const [loaded, setLoaded] = useState<LoadedSection | null>(cached ? { section, Component: cached } : null);

  useEffect(() => {
    if (section === "report") {
      setLoaded({ section, Component: Report });
      return;
    }

    const loader = sectionLoaders[section];
    let mounted = true;

    if (!loader) {
      setLoaded(null);
      return;
    }

    const cachedComponent = sectionCache.get(section);
    if (cachedComponent) {
      if (mounted) {
        setLoaded({ section, Component: cachedComponent });
      }
      return;
    }

    setLoaded(null);

    loader()
      .then((LoadedComponent) => {
        if (mounted) {
          sectionCache.set(section, LoadedComponent);
          setLoaded({ section, Component: LoadedComponent });
        }
      })
      .catch((err) => {
        console.error(`Failed to load section "${section}":`, err);
        if (mounted) {
          setLoaded({ section, Component: Report });
        }
      });

    return () => {
      mounted = false;
    };
  }, [section]);

  if (section === "report" || !sectionLoaders[section]) {
    return <Report />;
  }

  if (!loaded || loaded.section !== section) {
    return <PageLoader />;
  }

  const { Component } = loaded;

  return <Component />;
};

const VALID_SECTIONS: SectionName[] = ["report", "charts", "timeline"];

export const SectionSwitcher = () => {
  const section = VALID_SECTIONS.includes(currentSection.value as SectionName)
    ? (currentSection.value as SectionName)
    : "report";

  return (
    <div className={styles.layout}>
      <LazySection section={section} />
    </div>
  );
};
