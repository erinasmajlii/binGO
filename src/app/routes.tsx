import { createBrowserRouter, createMemoryRouter } from "react-router";
import { Home } from "./pages/Home";
import { Map } from "./pages/Map";
import { Report } from "./pages/Report";
import { Missions } from "./pages/Missions";
import { Profile } from "./pages/Profile";
import { Welcome } from "./pages/Welcome";
import { Register } from "./pages/Register";
import { Layout } from "./components/Layout";

const createRouter = typeof window !== 'undefined' ? createBrowserRouter : createMemoryRouter;

export const router = createRouter([
  {
    path: "/welcome",
    Component: Welcome,
  },
  {
    path: "/register",
    Component: Register,
  },
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: "map", Component: Map },
      { path: "report", Component: Report },
      { path: "missions", Component: Missions },
      { path: "profile", Component: Profile },
    ],
  },
]);
