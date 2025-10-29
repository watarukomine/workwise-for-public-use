
/**
 * @OnlyCurrentDoc
 *
 * The above comment directs App Script to limit the scope of file
 * access for this script to only the current document containing the script.
 * This is a security best practice.
 */

// This function handles all incoming POST requests from the web app.
function doPost(e) {
  let response;
  try {
    // It's crucial to wrap this in a try-catch block to handle any errors.
    // The `e` object contains information about the request.
    // For a POST request with a JSON payload, the data is in `e.postData.string`.
    if (!e || !e.postData || !e.postData.string) {
      throw new Error("Invalid POST data received.");
    }
    
    // Parse the JSON string from the request body into a JavaScript object.
    const args = JSON.parse(e.postData.string);

    // Call the main handler function with the parsed arguments.
    response = handleCalendarUpdate(args);

  } catch (error) {
    // If an error occurs, create an error response object.
    response = {
      status: 'error',
      message: 'GAS Script Error: ' + error.toString(),
    };
  }
  
  // Return the response. It must be JSON formatted and sent as a string.
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// This is the main logic function that interacts with Google Calendar.
function handleCalendarUpdate(args) {
  const { operation, calendarId, eventId, title, description, startTime, endTime } = args;

  // Validate required parameters.
  if (!operation || !calendarId) {
    throw new Error("Missing required parameters: operation and calendarId.");
  }

  // Get the calendar by its ID. If not found, throw an error.
  const calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) {
    throw new Error(`Calendar with ID "${calendarId}" not found or access denied.`);
  }

  // Use a switch statement to handle different operations.
  switch (operation) {
    case 'create':
      if (!title || !startTime || !endTime) {
        throw new Error("Missing parameters for 'create': title, startTime, and endTime are required.");
      }
      // Create a new event and get its ID.
      const newEvent = calendar.createEvent(
        title,
        new Date(startTime),
        new Date(endTime),
        { description: description || '' }
      );
      return {
        status: 'success',
        message: 'Event created successfully.',
        eventId: newEvent.getId() // Return the ID of the newly created event.
      };

    case 'update':
      if (!eventId || !title || !startTime || !endTime) {
        throw new Error("Missing parameters for 'update': eventId, title, startTime, and endTime are required.");
      }
      // Get the event by its ID.
      const eventToUpdate = calendar.getEventById(eventId);
      if (!eventToUpdate) {
        throw new Error(`Event with ID "${eventId}" not found.`);
      }
      // Update the event's properties.
      eventToUpdate.setTitle(title);
      eventToUpdate.setTime(new Date(startTime), new Date(endTime));
      eventToUpdate.setDescription(description || '');
      return {
        status: 'success',
        message: 'Event updated successfully.',
        eventId: eventId
      };

    case 'delete':
      if (!eventId) {
        throw new Error("Missing parameter for 'delete': eventId is required.");
      }
      // Get the event by its ID and delete it.
      const eventToDelete = calendar.getEventById(eventId);
      if (!eventToDelete) {
        // If event is already deleted, consider it a success.
        return { status: 'success', message: 'Event not found, may have been already deleted.' };
      }
      eventToDelete.deleteEvent();
      return {
        status: 'success',
        message: 'Event deleted successfully.'
      };

    default:
      // If the operation is unknown, throw an error.
      throw new Error(`Unknown operation: "${operation}"`);
  }
}
