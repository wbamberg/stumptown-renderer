import React from "react";
import { Link } from "@reach/router";

import { NoMatch } from "./routing";
import { InteractiveExample } from "./ingredients/interactive-example";
import { Attributes } from "./ingredients/attributes";
import { Examples } from "./ingredients/examples";
import { BrowserCompatibilityTable } from "./ingredients/browser-compatibility-table";

export class Document extends React.Component {
  state = {
    document: this.props.document || null,
    loading: false,
    notFound: false,
    loadingError: null
  };

  componentDidMount() {
    if (!this.state.document) {
      this.fetchDocument();
    }
  }

  componentDidUpdate(prevProps) {
    const currentSlug = this.props["*"];
    const prevSlug = prevProps["*"];
    if (currentSlug !== prevSlug) {
      this.fetchDocument();
    }
  }

  fetchDocument = () => {
    this.setState({ loading: true }, async () => {
      let url = document.location.pathname;
      if (!url.endsWith("/")) url += "/";
      url += "index.json";
      console.log("OPENING", url);
      let response;
      try {
        response = await fetch(url);
      } catch (ex) {
        return this.setState({ loading: false, loadingError: ex });
      }
      if (!response.ok) {
        console.warn(response);
        return this.setState({ loading: false, loadingError: response });
      } else {
        const data = await response.json();
        document.title = data.document.title;
        this.setState({ document: data.document, loading: false });
      }
    });
  };

  render() {
    const { document, loadingError, loading, notFound } = this.state;
    const { location } = this.props;
    if (notFound) {
      return <NoMatch location={location} message="Document not found" />;
    }
    if (loading) {
      return <p>Loading...</p>;
    }
    if (loadingError) {
      return <LoadingError error={loadingError} />;
    }
    if (!document) {
      return null;
    }
    return (
      <div>
        <h1 className="page-title">{document.title}</h1>
        <div className="main">
          <div className="sidebar">
            <RenderSideBar document={document} />
          </div>
          <div className="content">
            <RenderDocumentBody document={document} />
            <hr />
            {document.contributors && (
              <Contributors contributors={document.contributors} />
            )}
          </div>
        </div>
      </div>
    );
  }
}

function RenderSideBar({ document }) {
  return document.related_content.map(node => (
    <SidebarLeaf
      key={node.title}
      depth={0}
      title={node.title}
      content={node.content || []}
    />
  ));
}

function SidebarLeaf({ title, content }) {
  const titleNode = <h3>{title}</h3>;
  return (
    <div>
      {titleNode}
      <ul>
        {content.map(node => {
          if (node.content) {
            return (
              <li key={node.title}>
                <SidebarLeaflets node={node} />
              </li>
            );
          } else {
            return (
              <li key={node.uri}>
                <Link to={node.uri}>{node.title}</Link>
              </li>
            );
          }
        })}
      </ul>
    </div>
  );
}

function SidebarLeaflets({ node }) {
  return (
    <details>
      <summary>{node.title}</summary>
      <ol>
        {node.content.map(childNode => {
          return (
            <li key={childNode.uri}>
              <Link to={childNode.uri}>{childNode.title}</Link>
            </li>
          );
        })}
      </ol>
    </details>
  );
}

/** These prose sections should be rendered WITHOUT a heading. */
const PROSE_NO_HEADING = ["short_description", "overview"];

function RenderDocumentBody({ document }) {
  const sections = [];
  /**
   * The reason we can't return a filtered map of 'document.body' is because
   * some of the parts of 'document.body' is an array.
   * E.g. document.body.additional_prose == [
   *     {type: 'prose', value: STUFF},
   *     {type: 'prose', value: OTHER_STUFF},
   * ]
   */
  document.body.forEach((section, i) => {
    if (section.type === "prose") {
      // Only exceptional few should use the <Prose/> component,
      // as opposed to <ProseWithHeading/>.
      if (PROSE_NO_HEADING.includes(section.value.id)) {
        sections.push(<Prose key={section.value.id} section={section.value} />);
      } else {
        sections.push(
          <ProseWithHeading
            key={section.value.id}
            id={section.value.id}
            section={section.value}
          />
        );
      }
    } else if (section.type === "additional_prose") {
      section.value.forEach((subsection, j) => {
        if (subsection.type === "prose" && subsection.value) {
          sections.push(
            <ProseWithHeading
              key={`${subsection.title}${i}${j}`}
              section={subsection.value}
            />
          );
        } else {
          console.warn("Don't know how to deal with subsection:", subsection);
        }
      });
    } else if (section.type === "interactive_example") {
      sections.push(
        <InteractiveExample
          key={section.value}
          src={section.value}
          document={document}
        />
      );
    } else if (section.type === "attributes") {
      sections.push(
        <Attributes key={`attributes${i}`} attributes={section.value} />
      );
    } else if (section.type === "browser_compatibility") {
      sections.push(
        <BrowserCompatibilityTable
          key="browser_compatibility"
          data={section.value}
        />
      );
    } else if (section.type === "examples") {
      sections.push(<Examples key={`examples${i}`} examples={section.value} />);
    } else if (section.type === "info_box") {
      // XXX Unfinished!
      // https://github.com/mdn/stumptown-content/issues/106
      console.warn("Don't know how to deal with info_box!");
      // console.log(section);
    } else {
      console.warn(section);
      throw new Error(`No idea how to handle a '${section.type}' section`);
    }
  });

  return sections;
}

function Prose({ section }) {
  return <div dangerouslySetInnerHTML={{ __html: section.content }} />;
}

function ProseWithHeading({ id, section }) {
  if (!id) {
    id = section.title.replace(/\s+/g, "_").trim();
  }
  return (
    <>
      <h2 id={id}>{section.title}</h2>
      <div dangerouslySetInnerHTML={{ __html: section.content }} />
    </>
  );
}

function Contributors({ contributors }) {
  return (
    <div>
      <b>Contributors to this page:</b>
      <span dangerouslySetInnerHTML={{ __html: contributors }} />
    </div>
  );
}

function LoadingError({ error }) {
  return (
    <div className="loading-error">
      <h3>Loading Error</h3>
      {error instanceof window.Response ? (
        <p>
          <b>{error.status}</b> on <b>{error.url}</b>
          <br />
          <small>{error.statusText}</small>
        </p>
      ) : (
        <p>
          <code>{error.toString()}</code>
        </p>
      )}
    </div>
  );
}
