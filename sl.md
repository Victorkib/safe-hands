 To test your system in the development environment, you can use the Daraja API Sandbox. The Sandbox is a replica of the live production environment that allows you to test your application without affecting live data. Here's how you can test your system:

1. **Create a Test App**: You've already done this step. If you need to create another one for testing purposes, log in to your account, click on "Getting Started", navigate to the "MY APPS" tab, click "Create New App", fill out the required fields, and click "Create App".

2. **Generate an Access Token**: Before you can make any API calls, you need to generate an access token. You can do this by making a POST request to the following URL: `https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials`. Make sure to include your Consumer Key and Consumer Secret in the request headers for authentication. The response will include an access token that you can use to authenticate your API requests.

3. **Simulate the API**: Navigate to the "APIs" tab, choose the API you want to test, and click "Simulate". Select your app from the simulator dropdown and run the test by clicking the "Simulate" button. This will allow you to see how the API responds to different requests.

4. **Integrate the API into Your Code**: Once you've tested the API in the Sandbox, you can integrate it into your code. The exact method for doing this will depend on the programming language you're using and the specific requirements of your application. You can use the generated code on the simulator as a starting point.

5. **Test Your Application**: After integrating the API into your code, you should thoroughly test your application to ensure it works as expected. This should include testing all possible scenarios and edge cases.

Remember, all the testing should be done using the Sandbox environment and test short codes. Once you're confident that your application works correctly, you can move it into production.