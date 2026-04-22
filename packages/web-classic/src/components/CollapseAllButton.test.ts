import { render, screen, fireEvent } from '@testing-library/react';
import { CollapseAllButton } from './CollapseAllButton';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import treeReducer from '../redux/treeSlice';
import { ALLURE_PLUGIN_KEY } from '../utils/constants';

const renderWithStore = (initialState = {}) => {
  const store = configureStore({
    reducer: {
      [ALLURE_PLUGIN_KEY]: treeReducer,
    },
    preloadedState: {
      [ALLURE_PLUGIN_KEY]: initialState,
    },
  });

  return {
    store,
    ...render(
      <Provider store={store}>
        <CollapseAllButton />
      </Provider>,
    ),
  };
};

describe('CollapseAllButton', () => {
  it('renders the collapse all button', () => {
    renderWithStore();
    expect(screen.getByText(/collapse all/i)).toBeInTheDocument();
  });

  it('dispatches toggleTreeCollapsed action when clicked', () => {
    const { store } = renderWithStore();
    const button = screen.getByText(/collapse all/i);
    fireEvent.click(button);
    expect(store.getState()[ALLURE_PLUGIN_KEY].treeCollapsed).toBe(true);
  });

  it('toggles collapsed state from false to true', () => {
    const { store } = renderWithStore({ treeCollapsed: false });
    const button = screen.getByText(/collapse all/i);
    fireEvent.click(button);
    expect(store.getState()[ALLURE_PLUGIN_KEY].treeCollapsed).toBe(true);
  });

  it('toggles collapsed state from true to false', () => {
    const { store } = renderWithStore({ treeCollapsed: true });
    const button = screen.getByText(/collapse all/i);
    fireEvent.click(button);
    expect(store.getState()[ALLURE_PLUGIN_KEY].treeCollapsed).toBe(false);
  });

  it('is a button element', () => {
    renderWithStore();
    expect(screen.getByText(/collapse all/i)).toBeInstanceOf(HTMLButtonElement);
  });
});
