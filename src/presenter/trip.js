import SortView from "../view/sort.js";
import DaysView from "../view/days.js";
import DayView from "../view/day.js";
import TripEventsView from "../view/trip-events.js";
import EventMessageView from "../view/event-message.js";
import {render, RenderPosition, remove} from "../utils/dom.js";
import {groupCardsByDay} from "../utils/date.js";
import {sortEventsByTime, sortEventsByPrice} from "../utils/utils.js";
import {EventMessage, SortType, UserAction, UpdateType, FilterType, InitialDayCounter} from "../constants.js";
import PointPresenter from "./point.js";
import {filter} from "../utils/filter.js";
import PointNewPresenter from "./point-new.js";

export default class Trip {
  constructor(container, pointsModel, filterModel) {
    this._pointsModel = pointsModel;
    this._filterModel = filterModel;
    this._pointPresenter = {};
    this._existDays = [];
    this._container = container;
    this._sortComponent = null;
    this._eventMessageNoEventsView = null;
    this._handleViewAction = this._handleViewAction.bind(this);
    this._handleModelEvent = this._handleModelEvent.bind(this);
    this._handleModeChange = this._handleModeChange.bind(this);
    this.createPoint = this.createPoint.bind(this);
    this._currentSortType = SortType.DEFAULT;
    this._daysComponent = new DaysView();
    this._handleKindChange = this._handleKindChange.bind(this);
    this._pointsModel.addObserver(this._handleModelEvent);
    this._filterModel.addObserver(this._handleModelEvent);
    this._pointNewPresenter = new PointNewPresenter(this._handleViewAction);
  }

  init() {
    this._renderSort();
    this._renderTrip();
  }

  createPoint() {
    this._currentSortType = SortType.EVENT;
    this._filterModel.set(UpdateType.MAJOR, FilterType.EVERYTHING);
    this._pointNewPresenter.init(
        this._sortComponent,
        this._getDestinations()
    );
  }

  _getPoints() {
    const filterType = this._filterModel.get();
    const points = this._pointsModel.getPoints();
    const filteredPoints = filter[filterType](points);

    switch (this._currentSortType) {
      case SortType.TIME:
        return filteredPoints.sort(sortEventsByTime);
      case SortType.PRICE:
        return filteredPoints.sort(sortEventsByPrice);
    }

    return filteredPoints;
  }

  _getDestinations() {
    return this._pointsModel.getDestinations();
  }

  _handleModeChange() {
    Object
      .values(this._pointPresenter)
      .forEach((presenter) => presenter.resetView());
  }

  _handleKindChange(sortType) {
    if (this._currentSortType === sortType) {
      return;
    }

    this._currentSortType = sortType;
    this._rerenderTripEvents();
  }

  _renderSort() {
    if (this._sortComponent !== null) {
      this._sortComponent = null;
    }

    this._sortComponent = new SortView(this._currentSortType);
    this._sortComponent.setKindChangeHandler(this._handleKindChange);
    render(this._container, this._sortComponent, RenderPosition.AFTER_BEGIN);
  }

  _renderTrip() {
    const pointCount = this._getPoints().length;

    if (this._isLoading) {
      this._renderLoading();
      return;
    }
    if (pointCount > 0) {
      this._renderTripEvents();
      return;
    }

    this._renderNoEvents();
  }

  _renderTripEvents() {
    this._renderEvents();
    render(this._container, this._daysComponent);
  }

  _rerenderTripEvents() {
    this._clearEvents();
    this._renderSort();
    this._renderTripEvents();
  }

  _renderNoEvents() {
    this._eventMessageNoEventsView = new EventMessageView(EventMessage.NO_EVENTS);
    render(this._container, this._eventMessageNoEventsView);
  }

  destroy() {
    this._clearEvents(true);

    remove(this._daysComponent);
    remove(this._sortComponent);

    this._pointsModel.removeObserver(this._rerenderTripEvents);
    this._filterModel.removeObserver(this._handleKindChange);
  }

  _handleViewAction(actionType, updateType, update) {

    switch (actionType) {
      case UserAction.UPDATE_POINT:
        this._pointsModel.update(updateType, update);
        break;
      case UserAction.ADD_POINT:
        this._pointsModel.add(updateType, update);
        break;
      case UserAction.DELETE_POINT:
        this._pointsModel.delete(updateType, update);
        break;
    }
  }

  _handleModelEvent(updateType, pointData) {
    switch (updateType) {
      case UpdateType.PATCH:
        this._pointPresenter[pointData.id].init(
            pointData,
            this._getDestinations()
        );
        break;
      case UpdateType.MINOR:
        this._clearEvents();
        this._renderSort();
        this._renderTrip();
        break;
      case UpdateType.MAJOR:
        this._clearEvents({resetSortType: true});
        this._renderSort();
        this._renderTrip();
        break;
    }
  }

  _handleModeChange() {
    Object
      .values(this._pointPresenter)
      .forEach((presenter) => presenter.resetView());
  }

  _clearEvents({resetSortType = false} = {}) {
    Object
    .values(this._pointPresenter)
    .forEach((presenter) => presenter.destroy());
    this._pointPresenter = {};
    this._existDays .forEach(remove);
    this._existDays = [];

    remove(this._eventMessageNoEventsView);
    remove(this._sortComponent);
    remove(this._daysComponent);

    if (resetSortType) {
      this._currentSortType = SortType.DEFAULT;
    }
  }

  _renderEvents() {
    if (this._currentSortType !== SortType.DEFAULT) {
      const dayComponent = new DayView(InitialDayCounter.ZERO, new Date());
      render(this._daysComponent, dayComponent);

      const tripEventsComponent = new TripEventsView();
      render(dayComponent, tripEventsComponent);

      this._renderCards(this._getPoints(), tripEventsComponent);
    } else {
      const days = groupCardsByDay(this._getPoints());

      Object.values(days).forEach((dayCards, counter) => {
        const dayComponent = new DayView(counter + 1, dayCards[0].startDate);
        render(this._daysComponent, dayComponent);

        const tripEventsComponent = new TripEventsView();
        render(dayComponent, tripEventsComponent);

        this._renderCards(dayCards, tripEventsComponent);
      });
    }
  }

  _renderCards(cards, tripEventsComponent) {
    cards.forEach((item) => {
      this._renderCard(item, tripEventsComponent);
    });
  }

  _renderCard(card, eventList) {
    const pointPresenter = new PointPresenter(eventList, this._handleViewAction, this._handleModeChange);
    pointPresenter.init(
        card,
        this._getDestinations()
    );
    this._pointPresenter[card.id] = pointPresenter;
  }
}
