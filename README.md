## Usage

[+] useTask
[+] usePerformTask
[+] useIsTaskRunning
[+] useTaskState

```js
users.js ---
...
function useCreateUser(handlers) {
  const { perform, ...others } = useTask({
    id: '/users/create',
    execute: async () => api.post('/users'),
    handlers,
  });

  return { createUser: perform, ...others };
}


sign-up.js ---
...
function SignUpPage() {
  const form = useForm();
  const { createUser, isRunning } = useCreateUser({
    onSuccess: (data) => {
      //
    },
    onError: (error) => {
      //
    }
  });

  function handleSubmit(e) {
    e.preventDefault();

    if (form.isValidated()) {
      createUser(form.values);
    }
  }

  ...

  return (
    <form onsubmit={handleSubmit}>
      ...
    </form>
  )
}



```
